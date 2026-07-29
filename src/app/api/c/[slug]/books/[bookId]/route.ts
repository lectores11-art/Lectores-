import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const { slug, bookId } = await params;
  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const supabase = await createClient();

  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("community_id", community.id)
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
