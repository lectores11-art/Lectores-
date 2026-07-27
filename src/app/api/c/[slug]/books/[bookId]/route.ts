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
    .select("*")
    .eq("id", bookId)
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

  return NextResponse.json({
    book,
    initialPage: userProgress?.current_page ?? 0,
  });
}
