import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  bookParamsSchema,
  bookmarkSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const paramsResult = parseData(bookParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, bookId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const bodyResult = await parseJsonBody(request, bookmarkSchema);
  if ("error" in bodyResult) return bodyResult.error;
  const { pageNumber, label } = bodyResult.data;

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
    .from("reading_bookmarks")
    .insert({
      user_id: user.id,
      book_id: bookId,
      page_number: pageNumber,
      label: label || `Página ${pageNumber + 1}`,
    })
    .select()
    .single();

  if (error) return internalErrorResponse("Error al crear marcador:", error);
  return NextResponse.json({ bookmark: data });
}
