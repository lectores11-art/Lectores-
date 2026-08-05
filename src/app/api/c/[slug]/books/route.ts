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
  PDF_EXTRACT_FAILURE_MESSAGE,
  ESTIMATED_PIPELINE_VERSION,
} from "@/lib/pdf/paginator";
import {
  BOOKS_BUCKET,
  COVER_BUCKET,
  isCommunityScopedPath,
} from "@/lib/storage/book-upload-paths";
import {
  bookFinalizeUploadSchema,
  parseJsonBody,
  slugParamsSchema,
  parseData,
} from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Keep response under Vercel’s ~4.5MB body cap. */
const BOOK_SELECT =
  "id, community_id, title, author, description, cover_url, pdf_storage_path, total_pages, table_of_contents, is_published, pipeline_version, created_at, updated_at";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message.slice(0, 240);
  if (typeof err === "string") return err.slice(0, 240);
  try {
    return JSON.stringify(err).slice(0, 240);
  } catch {
    return "unknown";
  }
}

async function removeStorageObjects(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  paths: { coverPath?: string | null; pdfPath?: string | null }
) {
  try {
    if (paths.coverPath) {
      await serviceClient.storage.from(COVER_BUCKET).remove([paths.coverPath]);
    }
    if (paths.pdfPath) {
      await serviceClient.storage.from(BOOKS_BUCKET).remove([paths.pdfPath]);
    }
  } catch (cleanupErr) {
    console.error("Storage cleanup failed:", cleanupErr);
  }
}

function fail(
  status: number,
  error: string,
  detail?: string,
  logContext?: string,
  logErr?: unknown
) {
  if (logContext) console.error(logContext, logErr ?? detail ?? error);
  // Put detail in `error` so the UI always shows the real cause.
  const message = detail ? `${error} — ${detail}` : error;
  return NextResponse.json({ error: message, detail: detail || undefined }, {
    status,
  });
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
      return fail(400, "Ruta de portada inválida");
    }
    if (
      pdfStoragePath &&
      !isCommunityScopedPath(community.id, pdfStoragePath)
    ) {
      return fail(400, "Ruta de PDF inválida");
    }

    serviceClient = await createServiceClient();

    const { error: coverStatError } = await serviceClient.storage
      .from(COVER_BUCKET)
      .download(coverStoragePath);
    if (coverStatError) {
      return fail(
        400,
        "No se encontró la portada subida. Volvé a intentar.",
        errorMessage(coverStatError),
        "Cover missing after client upload:",
        coverStatError
      );
    }

    const { data: publicData } = serviceClient.storage
      .from(COVER_BUCKET)
      .getPublicUrl(coverStoragePath);
    const coverUrl = publicData?.publicUrl;
    if (!coverUrl) {
      return fail(500, "No se pudo armar la URL de la portada.");
    }

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
        .select(BOOK_SELECT)
        .single();

      if (error) {
        await removeStorageObjects(serviceClient, {
          coverPath: coverStoragePath,
        });
        return fail(
          500,
          "No se pudo guardar la ficha del libro.",
          errorMessage(error),
          "Error al crear libro (catalog):",
          error
        );
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
      return fail(
        400,
        "No se encontró el PDF subido. Volvé a intentar.",
        pdfDownloadError ? errorMessage(pdfDownloadError) : "pdf missing",
        "PDF missing after client upload:",
        pdfDownloadError
      );
    }

    let pages;
    let toc;
    try {
      const buffer = Buffer.from(await pdfBlob.arrayBuffer());
      console.info("book finalize: pdf bytes", buffer.byteLength);

      // Nivel B (layout-aware) first — preserves TOC/centrado/listas.
      // Fallback Nivel A (texto) only if B fails, so upload still works.
      try {
        const { extractPositionedTextFromPdfBuffer } = await import(
          "@/lib/pdf/extract-positioned"
        );
        const { inferLayoutBlocks } = await import("@/lib/pdf/layout-inference");
        const { items: positioned, pageWidth } =
          await extractPositionedTextFromPdfBuffer(buffer);
        const layoutBlocks = inferLayoutBlocks(positioned, pageWidth);
        pages =
          layoutBlocks.length > 0
            ? paginateBlocksByLines(layoutBlocks)
            : paginateText(
                normalizeExtractedText(await extractTextFromPdfBuffer(buffer))
              );
        console.info(
          "book finalize: pipeline B pages",
          pages.length,
          "items",
          positioned.length,
          "pageWidth",
          pageWidth
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
        console.info("book finalize: pipeline A pages", pages.length);
      }

      if (pages.length > MAX_STORED_PAGES) {
        pages = pages.slice(0, MAX_STORED_PAGES);
      }
      toc = extractTOC(pages);

      const joined = pages.map((p) => p.content).join("\n");
      const looksEmpty =
        pages.length === 0 ||
        !joined.trim() ||
        joined.includes(PDF_EXTRACT_FAILURE_MESSAGE) ||
        joined.includes("Este libro no tiene contenido extraíble");
      if (looksEmpty) {
        throw new Error(
          "No se pudo leer texto del PDF (¿es un escaneo sin texto seleccionable?). Probá otro archivo."
        );
      }
    } catch (processErr) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
      return fail(
        500,
        "No se pudo procesar el PDF.",
        errorMessage(processErr),
        "PDF processing failed:",
        processErr
      );
    }

    const { data: book, error } = await serviceClient
      .from("books")
      .insert({
        community_id: community.id,
        title,
        author: author || null,
        description: description || null,
        cover_url: coverUrl,
        pdf_storage_path: pdfStoragePath,
        content_json: pages,
        total_pages: pages.length,
        table_of_contents: toc,
        is_published: true,
        // Estimate only — first open DOM-packs and upgrades to PIPELINE_VERSION.
        pipeline_version: ESTIMATED_PIPELINE_VERSION,
      })
      .select(BOOK_SELECT)
      .single();

    if (error) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
      return fail(
        500,
        "No se pudo guardar el libro en la base de datos.",
        errorMessage(error),
        "Error al crear libro (pdf):",
        error
      );
    }

    return NextResponse.json({ book });
  } catch (err) {
    if (serviceClient) {
      await removeStorageObjects(serviceClient, {
        coverPath: coverStoragePath,
        pdfPath: pdfStoragePath,
      });
    }
    return fail(
      500,
      "Error interno",
      errorMessage(err),
      "POST /api/c/[slug]/books failed:",
      err
    );
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
