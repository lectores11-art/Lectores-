import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  internalErrorResponse,
  membershipParamsSchema,
  membershipStatusPatchSchema,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

const OWNER_KICK_MESSAGE =
  "No podés expulsar a la dueña de la comunidad.";

async function deactivateMembership(
  slug: string,
  membershipId: string
) {
  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: target, error: fetchError } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("id", membershipId)
    .eq("community_id", community.id)
    .maybeSingle();

  if (fetchError) {
    return internalErrorResponse("Error al buscar membresía:", fetchError);
  }
  if (!target) {
    return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
  }

  const isOwner =
    target.user_id === community.owner_id || target.role === "community_owner";
  if (isOwner) {
    return NextResponse.json({ error: OWNER_KICK_MESSAGE }, { status: 403 });
  }

  if (target.status !== "active") {
    return NextResponse.json({
      success: true,
      membership: { id: target.id, status: target.status },
    });
  }

  // Soft-deactivate only — never delete auth.users.
  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update({ status: "cancelled" })
    .eq("id", target.id)
    .eq("community_id", community.id)
    .select("id, user_id, role, status, joined_at, created_at")
    .single();

  if (updateError) {
    return internalErrorResponse("Error al desactivar membresía:", updateError);
  }

  return NextResponse.json({ success: true, membership: updated });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; membershipId: string }> }
) {
  try {
    const paramsResult = parseData(membershipParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, membershipId } = paramsResult.data;

    const bodyResult = await parseJsonBody(request, membershipStatusPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;

    return deactivateMembership(slug, membershipId);
  } catch (err) {
    return internalErrorResponse(
      "PATCH /api/c/[slug]/members/[membershipId] failed:",
      err
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; membershipId: string }> }
) {
  try {
    const paramsResult = parseData(membershipParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, membershipId } = paramsResult.data;

    return deactivateMembership(slug, membershipId);
  } catch (err) {
    return internalErrorResponse(
      "DELETE /api/c/[slug]/members/[membershipId] failed:",
      err
    );
  }
}
