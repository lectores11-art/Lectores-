import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  internalErrorResponse,
  inviteParamsSchema,
  invitePatchSchema,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

async function revokeInvite(slug: string, inviteId: string) {
  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const admin = await isCommunityAdmin(
    community.id,
    user.id,
    user.is_super_admin
  );
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("invites")
    .update({ is_active: false })
    .eq("id", inviteId)
    .eq("community_id", community.id)
    .select("id, token, use_count, max_uses, is_active, expires_at, created_at")
    .maybeSingle();

  if (error) return internalErrorResponse("Error al revocar invitación:", error);
  if (!invite) {
    return NextResponse.json(
      { error: "Invitación no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json({ invite });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; inviteId: string }> }
) {
  try {
    const paramsResult = parseData(inviteParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, inviteId } = paramsResult.data;

    const bodyResult = await parseJsonBody(request, invitePatchSchema);
    if ("error" in bodyResult) return bodyResult.error;

    return await revokeInvite(slug, inviteId);
  } catch (err) {
    return internalErrorResponse(
      "PATCH /api/c/[slug]/invites/[inviteId] failed:",
      err
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; inviteId: string }> }
) {
  try {
    const paramsResult = parseData(inviteParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, inviteId } = paramsResult.data;

    return await revokeInvite(slug, inviteId);
  } catch (err) {
    return internalErrorResponse(
      "DELETE /api/c/[slug]/invites/[inviteId] failed:",
      err
    );
  }
}
