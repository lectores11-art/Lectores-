import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Membership, Profile } from "@/lib/types/database";

function formatError(error: unknown): string {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "Error desconocido";
  if (typeof error === "object") {
    const record = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      msg?: string;
    };
    return (
      record.message ||
      record.msg ||
      record.details ||
      record.hint ||
      record.code ||
      "Error desconocido"
    );
  }
  return String(error);
}

async function ensureProfile(
  serviceClient: SupabaseClient,
  userId: string,
  email: string,
  fullName?: string
) {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profile) return userId;

  const { error } = await serviceClient.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName || email.split("@")[0],
  });

  if (error) {
    throw new Error(formatError(error));
  }

  return userId;
}

// Creates the community owner in Supabase Auth AND sends her an invite email
// with a link to set her password. The email template must point to
// /auth/confirm?token_hash=...&type=invite&next=/onboarding/set-password
async function inviteOwnerByEmail(serviceClient: SupabaseClient, email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/onboarding/set-password`,
    data: { full_name: email.split("@")[0] },
  });

  if (error) {
    const message = formatError(error);
    if (message.toLowerCase().includes("database error")) {
      throw new Error(
        "Supabase no pudo crear el perfil automáticamente. Ejecutá en SQL Editor el archivo supabase/migrations/002_fix_auth_trigger.sql y volvé a intentar."
      );
    }
    throw new Error(message);
  }

  if (!data.user?.id) {
    throw new Error("Supabase Auth no devolvió el ID del usuario invitado");
  }

  return data.user.id;
}

async function findAuthUserIdByEmail(
  serviceClient: SupabaseClient,
  email: string
) {
  const { data: usersList, error: listError } =
    await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (listError) {
    throw new Error(formatError(listError));
  }

  return usersList.users.find(
    (user) => user.email?.toLowerCase() === email
  )?.id;
}

export async function getOrCreateOwnerByEmail(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const serviceClient = await createServiceClient();

  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    return existingProfile.id;
  }

  const existingAuthUserId = await findAuthUserIdByEmail(
    serviceClient,
    normalizedEmail
  );

  if (existingAuthUserId) {
    return ensureProfile(serviceClient, existingAuthUserId, normalizedEmail);
  }

  try {
    const userId = await inviteOwnerByEmail(serviceClient, normalizedEmail);
    return ensureProfile(serviceClient, userId, normalizedEmail);
  } catch (error) {
    const message = formatError(error);
    if (message.toLowerCase().includes("already")) {
      const retryUserId = await findAuthUserIdByEmail(
        serviceClient,
        normalizedEmail
      );
      if (retryUserId) {
        return ensureProfile(serviceClient, retryUserId, normalizedEmail);
      }
    }
    throw new Error(message);
  }
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return profile as Profile;

  // Session exists but no profile row (e.g. the auth trigger did not run).
  // Create it from the auth user so we never leave an authenticated user
  // without a profile (which would cause a /login <-> /dashboard redirect loop).
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const serviceClient = await createServiceClient();
      const { data: created } = await serviceClient
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();

      if (created) return created as Profile;
    } catch (err) {
      console.error("getCurrentUser: profile upsert failed:", err);
    }
  } else {
    console.error(
      "getCurrentUser: SUPABASE_SERVICE_ROLE_KEY missing — cannot create profile fallback"
    );
  }

  // Last resort: never return null when auth session exists (prevents redirect loops).
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    avatar_url: null,
    is_super_admin: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Profile;
}

export async function getMembership(communityId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("*, community:communities(*)")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .single();

  return data as (Membership & { community: Community }) | null;
}

export async function getCommunityBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  return data as Community | null;
}

export async function requireCommunityAccess(slug: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, community: null, membership: null };

  const community = await getCommunityBySlug(slug);
  if (!community) return { user, community: null, membership: null };

  const membership = await getMembership(community.id, user.id);
  const hasAccess =
    user.is_super_admin ||
    membership?.status === "active" ||
    community.owner_id === user.id;

  if (!hasAccess) {
    return { user, community, membership: null };
  }

  return { user, community, membership };
}

export async function isCommunityAdmin(
  communityId: string,
  userId: string,
  isSuperAdmin: boolean
) {
  if (isSuperAdmin) {
    return true;
  }

  const supabase = await createClient();
  const { data: community } = await supabase
    .from("communities")
    .select("owner_id")
    .eq("id", communityId)
    .single();

  if (community?.owner_id === userId) return true;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return membership?.role === "community_owner";
}
