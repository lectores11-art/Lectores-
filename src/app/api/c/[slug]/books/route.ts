import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import type { ReadingProgress } from "@/lib/types/database";
import {
  extractTextFromPdfBuffer,
  extractTOC,
  MAX_STORED_PAGES,
  normalizeExtractedText,
  paginateText,
  PIPELINE_VERSION,
} from "@/lib/pdf/paginator";
import {
  bookUploadFieldsSchema,
  internalErrorResponse,
  parseData,
  slugParamsSchema,
  validatePdfFile,
} from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Guard against huge JSONB inserts that can hit Postgres statement timeouts. */

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
    const file = formData.get("file") as File | null;
    const pdfError = validatePdfFile(file);
    if (pdfError) return pdfError;

    const fieldsResult = parseData(bookUploadFieldsSchema, {
      title: formData.get("title"),
      author: formData.get("author"),
      description: formData.get("description"),
    });
    if ("error" in fieldsResult) return fieldsResult.error;
    const { title, author, description } = fieldsResult.data;

    const buffer = Buffer.from(await file!.arrayBuffer());
    const rawText = await extractTextFromPdfBuffer(buffer);
    const text = normalizeExtractedText(rawText);
    const pages = paginateText(text);
    const storedPages =
      pages.length > MAX_STORED_PAGES ? pages.slice(0, MAX_STORED_PAGES) : pages;
    const toc = extractTOC(storedPages);

    const storagePath = `${community.id}/${Date.now()}-${file!.name}`;

    // Admin verified above — service_role for storage + insert avoids missing
    // storage RLS and slow/forbidden books RLS on large content_json payloads.
    const serviceClient = await createServiceClient();

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

    for (const progress of progressRows || []) {
      progressByBookId.set(progress.book_id, progress);
    }
  }

  const booksWithProgress = bookList.map((book) => ({
    ...book,
    reading_progress: progressByBookId.get(book.id) ?? null,
  }));

  return NextResponse.json({ books: booksWithProgress });
}
