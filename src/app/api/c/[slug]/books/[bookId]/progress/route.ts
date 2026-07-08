import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { currentPage, progressPercent } = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          current_page: currentPage,
          progress_percent: progressPercent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ progress: data });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

