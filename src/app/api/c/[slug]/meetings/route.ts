import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getCommunityBySlug, getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

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
    const body = await request.json();

    if (body.action === "create") {
      if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

      const roomName = `meeting-${community.slug}-${nanoid(8)}`;
      const supabase = await createClient();

      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert({
          community_id: community.id,
          host_id: user.id,
          title: body.title || "Reunión en vivo",
          description: body.description || null,
          livekit_room: roomName,
          active_book_id: body.activeBookId || null,
          status: "scheduled",
          scheduled_at: body.scheduledAt || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ meeting });
    }

    if (body.action === "token") {
      const { meetingId } = body;
      const supabase = await createClient();

      const { data: meeting } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .eq("community_id", community.id)
        .single();

      if (!meeting) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });

      const isHost = meeting.host_id === user.id || admin;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        return NextResponse.json({
          token: "demo-token",
          room: meeting.livekit_room,
          url: process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
          isHost,
          demo: true,
        });
      }

      const at = new AccessToken(apiKey, apiSecret, {
        identity: user.id,
        name: user.full_name || user.email,
      });

      at.addGrant({
        room: meeting.livekit_room,
        roomJoin: true,
        canPublish: isHost,
        canSubscribe: true,
      });

      const token = await at.toJwt();
      return NextResponse.json({
        token,
        room: meeting.livekit_room,
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        isHost,
      });
    }

    if (body.action === "start") {
      if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      const supabase = await createClient();
      await supabase
        .from("meetings")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", body.meetingId);
      return NextResponse.json({ success: true });
    }

    if (body.action === "end") {
      if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      const supabase = await createClient();
      await supabase
        .from("meetings")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", body.meetingId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, host:profiles(id, full_name), active_book:books(id, title)")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ meetings: meetings || [] });
}
