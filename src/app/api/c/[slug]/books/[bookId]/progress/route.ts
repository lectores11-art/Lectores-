import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  bookParamsSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
  readingProgressSchema,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  try {
    const paramsResult = parseData(bookParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { bookId } = paramsResult.data;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const bodyResult = await parseJsonBody(request, readingProgressSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { currentPage, progressPercent } = bodyResult.data;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          current_page: currentPage,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      )
      .select()
      .single();

    if (error) return internalErrorResponse("Error al guardar progreso:", error);
    return NextResponse.json({ progress: data });
  } catch (err) {
    return internalErrorResponse("POST /api/c/[slug]/books/[bookId]/progress failed:", err);
  }
}
