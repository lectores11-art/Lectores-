import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  contentReportPatchSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
  reportParamsSchema,
} from "@/lib/validation";

async function hideTarget(
  targetType: string,
  targetId: string,
  hidden: boolean
) {
  const service = await createServiceClient();
  if (targetType === "book") {
    await service.from("books").update({ is_hidden: hidden }).eq("id", targetId);
  } else if (targetType === "thread") {
    await service.from("forum_threads").update({ is_hidden: hidden }).eq("id", targetId);
  } else if (targetType === "lesson") {
    await service.from("lessons").update({ is_hidden: hidden }).eq("id", targetId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; reportId: string }> }
) {
  try {
    const paramsResult = parseData(reportParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, reportId } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bodyResult = await parseJsonBody(request, contentReportPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;

    const supabase = await createClient();
    const { data: report } = await supabase
      .from("content_reports")
      .select("*")
      .eq("id", reportId)
      .eq("community_id", community.id)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
    }

    const hidden = bodyResult.data.status === "hidden";
    await hideTarget(report.target_type, report.target_id, hidden);

    const { data, error } = await supabase
      .from("content_reports")
      .update({
        status: bodyResult.data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) return internalErrorResponse("Error al actualizar reporte:", error);
    return NextResponse.json({ report: data });
  } catch (err) {
    return internalErrorResponse("PATCH /api/c/[slug]/reports/[reportId] failed:", err);
  }
}
