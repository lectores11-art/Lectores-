import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  forumPostCreateSchema,
  forumThreadPatchSchema,
  internalErrorResponse,
  parseData,
  parseJsonBody,
  threadParamsSchema,
} from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; threadId: string }> }
) {
  const paramsResult = parseData(threadParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, threadId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const bodyResult = await parseJsonBody(request, forumThreadPatchSchema);
  if ("error" in bodyResult) return bodyResult.error;
  const body = bodyResult.data;

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*, community:communities(id, slug)")
    .eq("id", threadId)
    .eq("community_id", community.id)
    .single();

  if (!thread) return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });

  const admin = await isCommunityAdmin(thread.community_id, user.id, user.is_super_admin);

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
  const paramsResult = parseData(threadParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, threadId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { community } = access;

  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("*, author:profiles(id, full_name, avatar_url)")
    .eq("id", threadId)
    .eq("community_id", community.id)
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }

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
  const paramsResult = parseData(threadParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug, threadId } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const bodyResult = await parseJsonBody(request, forumPostCreateSchema);
  if ("error" in bodyResult) return bodyResult.error;
  const { content } = bodyResult.data;

  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("forum_threads")
    .select("id, reply_count")
    .eq("id", threadId)
    .eq("community_id", community.id)
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }

  const { data: post, error } = await supabase
    .from("forum_posts")
    .insert({ thread_id: threadId, author_id: user.id, content })
    .select("*, author:profiles(id, full_name, avatar_url)")
    .single();

  if (error) return internalErrorResponse("Error al crear respuesta:", error);

  await supabase
    .from("forum_threads")
    .update({ reply_count: thread.reply_count + 1 })
    .eq("id", threadId);

  return NextResponse.json({ post });
}
