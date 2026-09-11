import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import {
  contentReportPatchSchema,
  internalErrorResponse,
  parseJsonBody,
} from "@/lib/validation";
import { z } from "zod";

const paramsSchema = z.object({ reportId: z.string().uuid() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if ("error" in admin) return admin.error;

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const bodyResult = await parseJsonBody(request, contentReportPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;

    const supabase = await createClient();
    const { data: report } = await supabase
      .from("content_reports")
      .select("*")
      .eq("id", parsed.data.reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
    }

    const hidden = bodyResult.data.status === "hidden";
    const service = await createServiceClient();
    if (report.target_type === "book") {
      await service.from("books").update({ is_hidden: hidden }).eq("id", report.target_id);
    } else if (report.target_type === "thread") {
      await service.from("forum_threads").update({ is_hidden: hidden }).eq("id", report.target_id);
    } else if (report.target_type === "lesson") {
      await service.from("lessons").update({ is_hidden: hidden }).eq("id", report.target_id);
    }

    const { data, error } = await supabase
      .from("content_reports")
      .update({
        status: bodyResult.data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: admin.id,
      })
      .eq("id", parsed.data.reportId)
      .select("*")
      .single();

    if (error) return internalErrorResponse("Error al actualizar reporte:", error);
    return NextResponse.json({ report: data });
  } catch (err) {
    return internalErrorResponse("PATCH /api/platform/reports failed:", err);
  }
}
