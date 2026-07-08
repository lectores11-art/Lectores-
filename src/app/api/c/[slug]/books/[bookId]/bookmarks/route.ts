import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  const { bookId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { pageNumber, label } = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reading_bookmarks")
    .insert({
      user_id: user.id,
      book_id: bookId,
      page_number: pageNumber,
      label: label || `Página ${pageNumber + 1}`,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookmark: data });
}
