import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import { internalErrorResponse, parseData, slugParamsSchema } from "@/lib/validation";

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
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: members, error } = await supabase
      .from("memberships")
      .select(
        "id, user_id, role, status, joined_at, created_at, profile:profiles(id, email, full_name, avatar_url)"
      )
      .eq("community_id", community.id)
      .eq("status", "active")
      .order("joined_at", { ascending: true, nullsFirst: false });

    if (error) return internalErrorResponse("Error al listar miembros:", error);

    const rows = (members || []).map((member) => ({
      ...member,
      is_owner:
        member.user_id === community.owner_id ||
        member.role === "community_owner",
    }));

    return NextResponse.json({ members: rows });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/members failed:", err);
  }
}
