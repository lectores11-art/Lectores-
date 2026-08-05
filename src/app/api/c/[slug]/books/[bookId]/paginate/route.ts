import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  extractTOC,
  MAX_STORED_PAGES,
  PIPELINE_VERSION,
  type PaginatedPage,
} from "@/lib/pdf/paginator";
import {
  bookPaginateSchema,
  bookParamsSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

export const runtime = "nodejs";

const BOOK_SELECT =
  "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, created_at, updated_at";

/**
 * Persist DOM-packed pages (current PIPELINE_VERSION). Any community member can
 * trigger this on first open; service_role writes because books UPDATE is
 * admin-only in RLS.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const paramsResult = parseData(bookParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, bookId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { community } = access;

  const bodyResult = await parseJsonBody(request, bookPaginateSchema);
  if ("error" in bodyResult) return bodyResult.error;

  let pages = bodyResult.data.pages as PaginatedPage[];
  if (pages.length > MAX_STORED_PAGES) {
    pages = pages.slice(0, MAX_STORED_PAGES);
  }

  // Normalize page numbers to a contiguous 0..n-1 sequence.
  pages = pages.map((page, index) => ({
    ...page,
    pageNumber: index,
    content:
      page.content ||
      (page.blocks ?? []).map((b) => b.text).join("\n\n"),
  }));

  const toc =
    bodyResult.data.tableOfContents &&
    bodyResult.data.tableOfContents.length > 0
      ? bodyResult.data.tableOfContents
      : extractTOC(pages);

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("books")
    .select("id, pipeline_version, community_id")
    .eq("id", bookId)
    .eq("community_id", community.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
  }

  // Idempotent: already DOM-packed — return current metadata without overwrite.
  if ((existing.pipeline_version ?? 0) >= PIPELINE_VERSION) {
    const { data: book } = await supabase
      .from("books")
      .select(BOOK_SELECT)
      .eq("id", bookId)
      .single();
    return NextResponse.json({
      book,
      alreadyPacked: true,
      pipeline_version: PIPELINE_VERSION,
    });
  }

  try {
    const serviceClient = await createServiceClient();
    const { data: book, error } = await serviceClient
      .from("books")
      .update({
        content_json: pages,
        total_pages: pages.length,
        table_of_contents: toc,
        pipeline_version: PIPELINE_VERSION,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookId)
      .eq("community_id", community.id)
      .lt("pipeline_version", PIPELINE_VERSION)
      .select(BOOK_SELECT)
      .maybeSingle();

    if (error) {
      return internalErrorResponse("Error al guardar paginación:", error);
    }

    // Race: another request finished first.
    if (!book) {
      const { data: current } = await supabase
        .from("books")
        .select(BOOK_SELECT)
        .eq("id", bookId)
        .single();
      return NextResponse.json({
        book: current,
        alreadyPacked: true,
        pipeline_version: PIPELINE_VERSION,
      });
    }

    return NextResponse.json({
      book,
      alreadyPacked: false,
      pipeline_version: PIPELINE_VERSION,
    });
  } catch (err) {
    return internalErrorResponse("Error al guardar paginación:", err);
  }
}
