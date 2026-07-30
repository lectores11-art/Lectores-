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
  bookUploadFieldsSchema,
  coverContentType,
  internalErrorResponse,
  parseData,
  slugParamsSchema,
  validateCoverFile,
  validatePdfFile,
} from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const COVER_BUCKET = "book-covers";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

async function uploadCover(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  communityId: string,
  cover: File
): Promise<{ coverUrl: string } | { error: NextResponse }> {
  const coverBuffer = Buffer.from(await cover.arrayBuffer());
  const coverPath = `${communityId}/${Date.now()}-${sanitizeFileName(cover.name)}`;
  const contentType = coverContentType(cover);

  const { error: coverError } = await serviceClient.storage
    .from(COVER_BUCKET)
    .upload(coverPath, coverBuffer, { contentType });

  if (coverError) {
    return {
      error: internalErrorResponse("Error al subir portada a storage:", coverError),
    };
  }

  const {
    data: { publicUrl },
  } = serviceClient.storage.from(COVER_BUCKET).getPublicUrl(coverPath);

  return { coverUrl: publicUrl };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const formData = await request.formData();
    const fieldsResult = parseData(bookUploadFieldsSchema, {
      title: formData.get("title"),
      author: formData.get("author"),
      description: formData.get("description"),
      mode: formData.get("mode") || "pdf",
    });
    if ("error" in fieldsResult) return fieldsResult.error;
    const { title, author, description, mode } = fieldsResult.data;

    const cover = formData.get("cover") as File | null;
    const coverError = validateCoverFile(cover);
    if (coverError) return coverError;

    const serviceClient = await createServiceClient();
    const coverResult = await uploadCover(serviceClient, community.id, cover!);
    if ("error" in coverResult) return coverResult.error;
    const { coverUrl } = coverResult;

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

      if (error) return internalErrorResponse("Error al crear libro:", error);
      return NextResponse.json({ book });
    }

    const file = formData.get("file") as File | null;
    const pdfError = validatePdfFile(file);
    if (pdfError) return pdfError;

    const buffer = Buffer.from(await file!.arrayBuffer());

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
          : paginateText(normalizeExtractedText(await extractTextFromPdfBuffer(buffer)));
    } catch (layoutErr) {
      console.error("Level B pipeline failed, falling back to text pagination:", layoutErr);
      const text = normalizeExtractedText(await extractTextFromPdfBuffer(buffer));
      pages = paginateText(text);
    }

    const storedPages =
      pages.length > MAX_STORED_PAGES ? pages.slice(0, MAX_STORED_PAGES) : pages;
    const toc = extractTOC(storedPages);

    const storagePath = `${community.id}/${Date.now()}-${file!.name}`;

    const { error: storageError } = await serviceClient.storage
      .from("books")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (storageError) {
      return internalErrorResponse("Error al subir PDF a storage:", storageError);
    }

    const { data: book, error } = await serviceClient
      .from("books")
      .insert({
        community_id: community.id,
        title,
        author: author || null,
        description: description || null,
        cover_url: coverUrl,
        pdf_storage_path: storagePath,
        content_json: storedPages,
        total_pages: storedPages.length,
        table_of_contents: toc,
        is_published: true,
        pipeline_version: PIPELINE_VERSION,
      })
      .select()
      .single();

    if (error) return internalErrorResponse("Error al crear libro:", error);
    return NextResponse.json({ book });
  } catch (err) {
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
