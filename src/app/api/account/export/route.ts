import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabase = await createClient();
  const userId = user.id;

  const [
    memberships,
    progress,
    bookmarks,
    threads,
    posts,
    lessonProgress,
  ] = await Promise.all([
    supabase.from("memberships").select("id, community_id, role, status, joined_at").eq("user_id", userId),
    supabase.from("reading_progress").select("book_id, current_page, progress_percent, updated_at").eq("user_id", userId),
    supabase.from("reading_bookmarks").select("book_id, page_number, label, created_at").eq("user_id", userId),
    supabase.from("forum_threads").select("id, community_id, title, content, created_at").eq("author_id", userId),
    supabase.from("forum_posts").select("id, thread_id, content, created_at").eq("author_id", userId),
    supabase.from("lesson_progress").select("lesson_id, completed, progress_percent, updated_at").eq("user_id", userId),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      residence_country: user.residence_country ?? null,
      accepted_terms_at: user.accepted_terms_at ?? null,
      accepted_privacy_at: user.accepted_privacy_at ?? null,
      age_attested_at: user.age_attested_at ?? null,
      created_at: user.created_at,
    },
    memberships: memberships.data || [],
    reading_progress: progress.data || [],
    reading_bookmarks: bookmarks.data || [],
    forum_threads: threads.data || [],
    forum_posts: posts.data || [],
    lesson_progress: lessonProgress.data || [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hilo-de-letras-datos.json"',
    },
  });
}
