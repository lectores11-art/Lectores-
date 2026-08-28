import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateOwnerByEmail, requireSuperAdmin } from "@/lib/auth/helpers";
import { slugify } from "@/lib/utils";
import { nanoid } from "nanoid";
import { DEFAULT_INVITE_MAX_USES, DEFAULT_INVITE_TTL_DAYS } from "@/lib/invites/defaults";
import {
  internalErrorResponse,
  parseJsonBody,
  platformCommunityCreateSchema,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const bodyResult = await parseJsonBody(request, platformCommunityCreateSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { name, description, ownerEmail, monthlyPriceCents, commissionStartsAt } =
      bodyResult.data;

    // service_role: super-admin bootstrap — create community, owner membership, and invite.
    const serviceClient = await createServiceClient();
    const ownerId = await getOrCreateOwnerByEmail(ownerEmail);

    const slug = `${slugify(name)}-${nanoid(6)}`;

    const { data: community, error: communityError } = await serviceClient
      .from("communities")
      .insert({
        name,
        slug,
        description: description || null,
        owner_id: ownerId,
        monthly_price_cents: monthlyPriceCents ?? 0,
        accent_color: "#0ea5e9",
        ...(commissionStartsAt
          ? { commission_starts_at: `${commissionStartsAt}T00:00:00.000Z` }
          : {}),
      })
      .select()
      .single();

    if (communityError) {
      return internalErrorResponse("Error al crear comunidad:", communityError);
    }

    const { error: membershipError } = await serviceClient.from("memberships").insert({
      user_id: ownerId,
      community_id: community.id,
      role: "community_owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (membershipError) {
      await serviceClient.from("communities").delete().eq("id", community.id);
      return internalErrorResponse("Error al crear membresía:", membershipError);
    }

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_INVITE_TTL_DAYS);

    const { data: invite, error: inviteError } = await serviceClient
      .from("invites")
      .insert({
        community_id: community.id,
        created_by: ownerId,
        token: nanoid(24),
        max_uses: DEFAULT_INVITE_MAX_USES,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      return internalErrorResponse("Error al crear invitación:", inviteError);
    }

    return NextResponse.json({ community, invite });
  } catch (err) {
    return internalErrorResponse("POST /api/platform/communities failed:", err);
  }
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createClient();
  const { data: communities } = await supabase
    .from("communities")
    .select("*, invites(*)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ communities });
}
