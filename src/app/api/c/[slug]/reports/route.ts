import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  contentReportCreateSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
  slugParamsSchema,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const bodyResult = await parseJsonBody(request, contentReportCreateSchema);
    if ("error" in bodyResult) return bodyResult.error;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_reports")
      .insert({
        community_id: community.id,
        reporter_id: user.id,
        target_type: bodyResult.data.targetType,
        target_id: bodyResult.data.targetId,
        reason: bodyResult.data.reason,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !data) {
      return internalErrorResponse("Error al crear reporte:", error);
    }

    return NextResponse.json({ report: data });
  } catch (err) {
    return internalErrorResponse("POST /api/c/[slug]/reports failed:", err);
  }
}

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
    const { data, error } = await supabase
      .from("content_reports")
      .select("*")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return internalErrorResponse("Error al listar reportes:", error);
    return NextResponse.json({ reports: data || [] });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/reports failed:", err);
  }
}
