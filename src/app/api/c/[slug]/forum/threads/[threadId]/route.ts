import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> }
) {
  const { slug, threadId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*, community:communities(id, slug)")
    .eq("id", threadId)
    .single();

  if (!thread) return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });

  const admin = await isCommunityAdmin(thread.community_id, user.id, user.is_super_admin);
  const body = await request.json();

  if (body.action === "like") {
    const { data: existing } = await supabase
      .from("forum_reactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("thread_id", threadId)
      .single();

    if (existing) {
      await supabase.from("forum_reactions").delete().eq("id", existing.id);
      await supabase
        .from("forum_threads")
        .update({ like_count: Math.max(0, thread.like_count - 1) })
        .eq("id", threadId);
      return NextResponse.json({ liked: false });
    }

    await supabase.from("forum_reactions").insert({ user_id: user.id, thread_id: threadId });
    await supabase
      .from("forum_threads")
      .update({ like_count: thread.like_count + 1 })
      .eq("id", threadId);
    return NextResponse.json({ liked: true });
  }

  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const updates: Record<string, boolean> = {};
  if (typeof body.is_pinned === "boolean") updates.is_pinned = body.is_pinned;
  if (typeof body.is_featured === "boolean") updates.is_featured = body.is_featured;

  await supabase.from("forum_threads").update(updates).eq("id", threadId);
  return NextResponse.json({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> }
) {
  const { threadId } = await params;
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*, author:profiles(id, full_name, avatar_url)")
    .eq("id", threadId)
    .single();

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("*, author:profiles(id, full_name, avatar_url)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ thread, posts: posts || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> }
) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { content } = await request.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("forum_posts")
    .insert({ thread_id: threadId, author_id: user.id, content: content.trim() })
    .select("*, author:profiles(id, full_name, avatar_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("reply_count")
    .eq("id", threadId)
    .single();

  if (thread) {
    await supabase
      .from("forum_threads")
      .update({ reply_count: thread.reply_count + 1 })
      .eq("id", threadId);
  }

  return NextResponse.json({ post });
}
