import { randomUUID } from "node:crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community, Membership, Profile } from "@/lib/types/database";

const DEMO_PROFILE: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@lectores.local",
  full_name: "Admin Demo",
  avatar_url: null,
  is_super_admin: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

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

async function createAuthUser(email: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    throw new Error("Faltan variables de Supabase en .env.local");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: `Tmp-${randomUUID()}`,
      email_confirm: true,
      user_metadata: {
        full_name: email.split("@")[0],
      },
    }),
  });

  const payload = (await response.json()) as {
    id?: string;
    msg?: string;
    message?: string;
    error_description?: string;
  };

  if (!response.ok) {
    const authMessage =
      payload.msg ||
      payload.message ||
      payload.error_description ||
      `No se pudo crear usuario en Supabase Auth (HTTP ${response.status})`;

    if (authMessage.toLowerCase().includes("database error creating new user")) {
      throw new Error(
        "Supabase no pudo crear el perfil automáticamente. Ejecutá en SQL Editor el archivo supabase/migrations/002_fix_auth_trigger.sql y volvé a intentar."
      );
    }

    throw new Error(authMessage);
  }

  if (!payload.id) {
    throw new Error("Supabase Auth no devolvió el ID del usuario");
  }

  return payload.id;
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
    const userId = await createAuthUser(normalizedEmail);
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

let _demoProfileSeeded = false;

async function ensureDemoProfile() {
  if (_demoProfileSeeded) return;

  const serviceClient = await createServiceClient();

  const { data: existing } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", DEMO_PROFILE.id)
    .maybeSingle();

  if (existing) {
    _demoProfileSeeded = true;
    return;
  }

  // Create the auth user with the fixed demo UUID so FK profile→auth.users holds
  const { error: authError } = await serviceClient.auth.admin.createUser({
    id: DEMO_PROFILE.id,
    email: DEMO_PROFILE.email,
    email_confirm: true,
    user_metadata: { full_name: DEMO_PROFILE.full_name },
  });

  if (authError && !authError.message.toLowerCase().includes("already")) {
    console.error("ensureDemoProfile: no se pudo crear auth user:", authError.message);
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: DEMO_PROFILE.id,
    email: DEMO_PROFILE.email,
    full_name: DEMO_PROFILE.full_name,
    is_super_admin: true,
  });

  if (profileError) {
    console.error("ensureDemoProfile: no se pudo upsert profile:", profileError.message);
  } else {
    _demoProfileSeeded = true;
  }
}

export async function getCurrentUser() {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
    await ensureDemoProfile();
    return DEMO_PROFILE;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile as Profile | null;
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

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
    return { user, community, membership: null };
  }

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
  if (isSuperAdmin || process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
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
