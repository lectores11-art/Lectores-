import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import type { ReadingProgress } from "@/lib/types/database";
import {
  extractTextFromPdfBuffer,
  extractTOC,
  MAX_STORED_PAGES,
  normalizeExtractedText,
  paginateBlocksByLines,
  paginateText,
  PIPELINE_VERSION,
} from "@/lib/pdf/paginator";
import {
  BOOKS_BUCKET,
  COVER_BUCKET,
  isCommunityScopedPath,
} from "@/lib/storage/book-upload-paths";
import {
  bookFinalizeUploadSchema,
  internalErrorResponse,
  parseJsonBody,
  slugParamsSchema,
  parseData,
} from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

async function removeStorageObjects(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  paths: { coverPath?: string | null; pdfPath?: string | null }
) {
  if (paths.coverPath) {
    await serviceClient.storage.from(COVER_BUCKET).remove([paths.coverPath]);
  }
  if (paths.pdfPath) {
    await serviceClient.storage.from(BOOKS_BUCKET).remove([paths.pdfPath]);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  let coverStoragePath: string | null = null;
  let pdfStoragePath: string | null = null;
  let serviceClient: Awaited<ReturnType<typeof createServiceClient>> | null =
    null;

  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

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

    const bodyResult = await parseJsonBody(request, bookFinalizeUploadSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { title, author, description, mode, coverStoragePath: coverPath } =
      bodyResult.data;
    coverStoragePath = coverPath;
    pdfStoragePath =
      mode === "pdf" ? bodyResult.data.pdfStoragePath || null : null;

    if (!isCommunityScopedPath(community.id, coverStoragePath)) {
      return NextResponse.json(
        { error: "Ruta de portada inválida" },
        { status: 400 }
      );
    }
    if (
      pdfStoragePath &&
      !isCommunityScopedPath(community.id, pdfStoragePath)
    ) {
      return NextResponse.json(
        { error: "Ruta de PDF inválida" },
        { status: 400 }
      );
    }

    serviceClient = await createServiceClient();

    const { error: coverStatError } = await serviceClient.storage
      .from(COVER_BUCKET)
      .download(coverStoragePath);
    if (coverStatError) {
      return NextResponse.json(
        { error: "No se encontró la portada subida. Volvé a intentar." },
        { status: 400 }
      );
    }

    const {
      data: { publicUrl: coverUrl },
    } = serviceClient.storage
      .from(COVER_BUCKET)
      .getPublicUrl(coverStoragePath);

    if (mode === "catalog") {
      const { data: book, error } = await serviceClient
        .from("books")
        .insert({
          community_id: community.id,
          title,
          author: author || null,
          description: description || null,
          cover_url: coverUrl,
          pdf_storage_path: null,
          content_json: [],
          total_pages: 0,
          table_of_contents: [],
          is_published: true,
          pipeline_version: 0,
        })
        .select()
        .single();

      if (error) {
        await removeStorageObjects(serviceClient, {
          coverPath: coverStoragePath,
        });
        return internalErrorResponse("Error al crear libro:", error);
      }
      return NextResponse.json({ book });
    }

    const { data: pdfBlob, error: pdfDownloadError } =
      await serviceClient.storage.from(BOOKS_BUCKET).download(pdfStoragePath!);

    if (pdfDownloadError || !pdfBlob) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
      return NextResponse.json(
        { error: "No se encontró el PDF subido. Volvé a intentar." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Lazy-load pdfjs pipeline only on upload — GET /books must not import pdfjs.
    let pages;
    try {
      const { extractPositionedTextFromPdfBuffer } = await import(
        "@/lib/pdf/extract-positioned"
      );
      const { inferLayoutBlocks } = await import("@/lib/pdf/layout-inference");
      const positioned = await extractPositionedTextFromPdfBuffer(buffer);
      const pageWidth =
        positioned.length > 0
          ? Math.max(...positioned.map((item) => item.x + item.width), 612)
          : 612;
      const layoutBlocks = inferLayoutBlocks(positioned, pageWidth);
      pages =
        layoutBlocks.length > 0
          ? paginateBlocksByLines(layoutBlocks)
          : paginateText(
              normalizeExtractedText(await extractTextFromPdfBuffer(buffer))
            );
    } catch (layoutErr) {
      console.error(
        "Level B pipeline failed, falling back to text pagination:",
        layoutErr
      );
      const text = normalizeExtractedText(
        await extractTextFromPdfBuffer(buffer)
      );
      pages = paginateText(text);
    }

    const storedPages =
      pages.length > MAX_STORED_PAGES ? pages.slice(0, MAX_STORED_PAGES) : pages;
    const toc = extractTOC(storedPages);

    const { data: book, error } = await serviceClient
      .from("books")
      .insert({
        community_id: community.id,
        title,
        author: author || null,
        description: description || null,
        cover_url: coverUrl,
        pdf_storage_path: pdfStoragePath,
        content_json: storedPages,
        total_pages: storedPages.length,
        table_of_contents: toc,
        is_published: true,
        pipeline_version: PIPELINE_VERSION,
      })
      .select()
      .single();

    if (error) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
      return internalErrorResponse("Error al crear libro:", error);
    }

    return NextResponse.json({ book });
  } catch (err) {
    if (serviceClient) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
    }
    return internalErrorResponse("POST /api/c/[slug]/books failed:", err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const paramsResult = parseData(slugParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const supabase = await createClient();
  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("community_id", community.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const bookList = books || [];
  const bookIds = bookList.map((book) => book.id);

  const progressByBookId = new Map<string, ReadingProgress>();

  if (bookIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select("*")
      .eq("user_id", user.id)
      .in("book_id", bookIds);

    for (const row of progressRows || []) {
      progressByBookId.set(row.book_id, row as ReadingProgress);
    }
  }

  const booksWithProgress = bookList.map((book) => ({
    ...book,
    reading_progress: progressByBookId.get(book.id) ?? null,
  }));

  return NextResponse.json({ books: booksWithProgress });
}
