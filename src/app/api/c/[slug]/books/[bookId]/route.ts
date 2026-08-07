import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  BOOKS_BUCKET,
  COVER_BUCKET,
  isCommunityScopedPath,
} from "@/lib/storage/book-upload-paths";
import {
  bookParamsSchema,
  internalErrorResponse,
  parseData,
} from "@/lib/validation";

function coverPathFromPublicUrl(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  const marker = `/object/public/${COVER_BUCKET}/`;
  const idx = coverUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(
    coverUrl.slice(idx + marker.length).split("?")[0] || ""
  );
  return path || null;
}

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  try {
    const paramsResult = parseData(bookParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, bookId } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(
      community.id,
      user.id,
      user.is_super_admin
    );
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // service_role: delete book row + storage objects after admin auth check.
    const serviceClient = await createServiceClient();
    const { data: book, error: fetchError } = await serviceClient
      .from("books")
      .select("id, community_id, pdf_storage_path, cover_url")
      .eq("id", bookId)
      .eq("community_id", community.id)
      .maybeSingle();

    if (fetchError) {
      return internalErrorResponse("Error al buscar libro:", fetchError);
    }
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    // Clear meeting pointers so FK without ON DELETE CASCADE does not block.
    await serviceClient
      .from("meetings")
      .update({ active_book_id: null })
      .eq("community_id", community.id)
      .eq("active_book_id", book.id);

    const { error: deleteError } = await serviceClient
      .from("books")
      .delete()
      .eq("id", book.id)
      .eq("community_id", community.id);

    if (deleteError) {
      return internalErrorResponse("Error al eliminar libro:", deleteError);
    }

    const coverPath = coverPathFromPublicUrl(book.cover_url);
    const pdfPath = book.pdf_storage_path as string | null;

    try {
      if (coverPath && isCommunityScopedPath(community.id, coverPath)) {
        await serviceClient.storage.from(COVER_BUCKET).remove([coverPath]);
      }
      if (pdfPath && isCommunityScopedPath(community.id, pdfPath)) {
        await serviceClient.storage.from(BOOKS_BUCKET).remove([pdfPath]);
      }
    } catch (cleanupErr) {
      console.error("Book storage cleanup failed:", cleanupErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalErrorResponse(
      "DELETE /api/c/[slug]/books/[bookId] failed:",
      err
    );
  }
}
