import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";
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
    const { slug, bookId } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const bodyResult = await parseJsonBody(request, readingProgressSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { currentPage, progressPercent } = bodyResult.data;

    const supabase = await createClient();

    const { data: book } = await supabase
      .from("books")
      .select("id")
      .eq("id", bookId)
      .eq("community_id", community.id)
      .maybeSingle();

    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

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
