import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  bookParamsSchema,
  bookPublishPatchSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const paramsResult = parseData(bookParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, bookId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const supabase = await createClient();

  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("community_id", community.id)
    .single();

  if (error || !book) {
    return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
  }

  const { data: userProgress } = await supabase
    .from("reading_progress")
    .select("current_page, progress_percent")
    .eq("book_id", bookId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Never return a public storage URL — clients must call .../pdf for a signed link.
  return NextResponse.json({
    book,
    initialPage: userProgress?.current_page ?? 0,
  });
}

export async function PATCH(
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

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const bodyResult = await parseJsonBody(request, bookPublishPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { is_published } = bodyResult.data;

    const supabase = await createClient();
    const { data: book, error } = await supabase
      .from("books")
      .update({ is_published })
      .eq("id", bookId)
      .eq("community_id", community.id)
      .select(
        "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, created_at, updated_at"
      )
      .maybeSingle();

    if (error) return internalErrorResponse("Error al actualizar libro:", error);
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch (err) {
    return internalErrorResponse("PATCH /api/c/[slug]/books/[bookId] failed:", err);
  }
}
