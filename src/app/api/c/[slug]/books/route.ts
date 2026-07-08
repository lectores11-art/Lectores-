import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";
import {
  extractTextFromPdfBuffer,
  paginateText,
  extractTOC,
} from "@/lib/pdf/paginator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const community = await getCommunityBySlug(slug);
    if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const author = formData.get("author") as string | null;
    const description = formData.get("description") as string | null;

    if (!file || !title) {
      return NextResponse.json({ error: "Archivo y título requeridos" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdfBuffer(buffer);
    const pages = paginateText(text);
    const toc = extractTOC(pages);

    const supabase = await createClient();

    // Ensure the 'books' bucket exists (may not have been created manually)
    const { error: bucketCheckError } = await supabase.storage.getBucket("books");
    if (bucketCheckError) {
      const { error: createBucketError } = await supabase.storage.createBucket("books", {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ["application/pdf"],
      });
      if (createBucketError) {
        console.error("No se pudo crear el bucket 'books':", createBucketError.message);
        return NextResponse.json(
          { error: `Error en Storage: ${createBucketError.message}` },
          { status: 500 }
        );
      }
    }

    const storagePath = `${community.id}/${Date.now()}-${file.name}`;

    const { error: storageError } = await supabase.storage
      .from("books")
      .upload(storagePath, buffer, { contentType: "application/pdf" });

    if (storageError) {
      console.error("Error al subir PDF a storage:", storageError.message);
      return NextResponse.json(
        { error: `Error al subir el archivo: ${storageError.message}` },
        { status: 500 }
      );
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ book });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar PDF" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const community = await getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

  const supabase = await createClient();
  const { data: books } = await supabase
    .from("books")
    .select("*, reading_progress:reading_progress(*)")
    .eq("community_id", community.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const booksWithProgress = (books || []).map((book) => {
    const progress = Array.isArray(book.reading_progress)
      ? book.reading_progress.find((p: { user_id: string }) => p.user_id === user.id)
      : book.reading_progress;
    return { ...book, reading_progress: progress || null };
  });

  return NextResponse.json({ books: booksWithProgress });
}
