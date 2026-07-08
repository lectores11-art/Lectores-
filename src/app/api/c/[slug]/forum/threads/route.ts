import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, getCurrentUser } from "@/lib/auth/helpers";

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
  const { data: threads } = await supabase
    .from("forum_threads")
    .select("*, author:profiles(id, full_name, avatar_url)")
    .eq("community_id", community.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return NextResponse.json({ threads: threads || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const community = await getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

  const { title, content } = await request.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Título y contenido requeridos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: thread, error } = await supabase
    .from("forum_threads")
    .insert({
      community_id: community.id,
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
    })
    .select("*, author:profiles(id, full_name, avatar_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thread });
}
