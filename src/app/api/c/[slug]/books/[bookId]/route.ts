import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const { bookId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = await createClient();

  const { data: book, error } = await supabase
    .from("books")
    .select("*, reading_progress:reading_progress(current_page, progress_percent, user_id)")
    .eq("id", bookId)
    .single();

  if (error || !book) {
    return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
  }

  // Filter reading progress for the current user server-side
  const progressRows = Array.isArray(book.reading_progress)
    ? book.reading_progress
    : book.reading_progress
    ? [book.reading_progress]
    : [];

  const userProgress = progressRows.find(
    (p: { user_id: string; current_page: number; progress_percent: number }) =>
      p.user_id === user.id
  );

  return NextResponse.json({
    book: { ...book, reading_progress: undefined },
    initialPage: userProgress?.current_page ?? 0,
  });
}
