import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, getOrCreateOwnerByEmail } from "@/lib/auth/helpers";
import { slugify } from "@/lib/utils";
import { nanoid } from "nanoid";
import {
  internalErrorResponse,
  parseJsonBody,
  platformCommunityCreateSchema,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.is_super_admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bodyResult = await parseJsonBody(request, platformCommunityCreateSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { name, description, ownerEmail, monthlyPriceCents } = bodyResult.data;

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
        monthly_price_cents: monthlyPriceCents || 0,
        accent_color: "#0ea5e9",
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

    const { data: invite, error: inviteError } = await serviceClient
      .from("invites")
      .insert({
        community_id: community.id,
        created_by: ownerId,
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
  const user = await getCurrentUser();
  if (!user?.is_super_admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: communities } = await supabase
    .from("communities")
    .select("*, invites(*)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ communities });
}
