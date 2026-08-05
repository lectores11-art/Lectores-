import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  extractTOC,
  MAX_STORED_PAGES,
  packMetricsStale,
  PIPELINE_VERSION,
  type PackMetrics,
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
  "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, pack_metrics, created_at, updated_at";

/**
 * Persist DOM-packed pages (current PIPELINE_VERSION). Any community member can
 * trigger this on first open or when the viewport changed enough to need a
 * re-pack; service_role writes because books UPDATE is admin-only in RLS.
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

  const incomingMetrics = bodyResult.data.packMetrics as
    | PackMetrics
    | undefined;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("books")
    .select("id, pipeline_version, community_id, pack_metrics")
    .eq("id", bookId)
    .eq("community_id", community.id)
    .maybeSingle();

  // If pack_metrics column is missing (migration 009 pending), retry without it.
  let existingRow = existing;
  let fetchErr = fetchError;
  if (fetchError && /pack_metrics/i.test(fetchError.message ?? "")) {
    const fallback = await supabase
      .from("books")
      .select("id, pipeline_version, community_id")
      .eq("id", bookId)
      .eq("community_id", community.id)
      .maybeSingle();
    existingRow = fallback.data
      ? { ...fallback.data, pack_metrics: null }
      : null;
    fetchErr = fallback.error;
  }

  if (fetchErr || !existingRow) {
    return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
  }

  const storedMetrics = existingRow.pack_metrics as PackMetrics | null;
  const viewportChanged =
    !!incomingMetrics && packMetricsStale(storedMetrics, incomingMetrics);
  const force = bodyResult.data.force === true || viewportChanged;
  const alreadyCurrent =
    (existingRow.pipeline_version ?? 0) >= PIPELINE_VERSION && !force;

  if (alreadyCurrent) {
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
    const payload = {
      content_json: pages,
      total_pages: pages.length,
      table_of_contents: toc,
      pipeline_version: PIPELINE_VERSION,
      pack_metrics: incomingMetrics ?? storedMetrics ?? null,
      updated_at: new Date().toISOString(),
    };

    let { data: book, error } = await serviceClient
      .from("books")
      .update(payload)
      .eq("id", bookId)
      .eq("community_id", community.id)
      .select(BOOK_SELECT)
      .maybeSingle();

    // Migration 009 not applied yet — persist pages without pack_metrics.
    if (error && /pack_metrics/i.test(error.message ?? "")) {
      const { pack_metrics: _drop, ...withoutMetrics } = payload;
      const retry = await serviceClient
        .from("books")
        .update(withoutMetrics)
        .eq("id", bookId)
        .eq("community_id", community.id)
        .select(
          "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, created_at, updated_at"
        )
        .maybeSingle();
      book = retry.data as typeof book;
      error = retry.error;
    }

    if (error) {
      return internalErrorResponse("Error al guardar paginación:", error);
    }

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
