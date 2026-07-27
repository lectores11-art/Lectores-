import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";
import type { ReadingProgress } from "@/lib/types/database";
import {
  extractTextFromPdfBuffer,
  paginateText,
  extractTOC,
} from "@/lib/pdf/paginator";
import {
  bookUploadFieldsSchema,
  internalErrorResponse,
  parseData,
  slugParamsSchema,
  validatePdfFile,
} from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const community = await getCommunityBySlug(slug);
    if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

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
    const text = await extractTextFromPdfBuffer(buffer);
    const pages = paginateText(text);
    const toc = extractTOC(pages);

    const supabase = await createClient();

    const storagePath = `${community.id}/${Date.now()}-${file!.name}`;

    const { error: storageError } = await supabase.storage
      .from("books")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (storageError) {
      return internalErrorResponse("Error al subir PDF a storage:", storageError);
    }

    const { data: book, error } = await supabase
      .from("books")
      .insert({
        community_id: community.id,
        title,
        author: author || null,
        description: description || null,
        pdf_storage_path: storagePath,
        content_json: pages,
        total_pages: pages.length,
        table_of_contents: toc,
        is_published: true,
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

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const community = await getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

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
