import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import { nanoid } from "nanoid";
import { internalErrorResponse, parseData, slugParamsSchema } from "@/lib/validation";

/** Default invite lifetime and use cap (abuse / shared-link hardening). */
const DEFAULT_INVITE_MAX_USES = 25;
const DEFAULT_INVITE_TTL_DAYS = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const supabase = await createClient();
    const { data: invites, error } = await supabase
      .from("invites")
      .select("id, token, use_count, max_uses, is_active, expires_at, created_at")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false });

    if (error) return internalErrorResponse("Error al listar invitaciones:", error);
    return NextResponse.json({ invites: invites || [] });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/invites failed:", err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_INVITE_TTL_DAYS);

    const supabase = await createClient();
    const { data: invite, error } = await supabase
      .from("invites")
      .insert({
        community_id: community.id,
        created_by: user.id,
        token: nanoid(24),
        max_uses: DEFAULT_INVITE_MAX_USES,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) return internalErrorResponse("Error al crear invitación:", error);
    return NextResponse.json({ invite });
  } catch (err) {
    return internalErrorResponse("POST /api/c/[slug]/invites failed:", err);
  }
}
