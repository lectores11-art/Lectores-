import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { internalErrorResponse } from "@/lib/validation";

export async function GET() {
  try {
    const admin = await requireSuperAdmin();
    if ("error" in admin) return admin.error;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_reports")
      .select("*, community:communities(slug, name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return internalErrorResponse("Error al listar reportes:", error);
    return NextResponse.json({ reports: data || [] });
  } catch (err) {
    return internalErrorResponse("GET /api/platform/reports failed:", err);
  }
}
