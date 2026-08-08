import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import {
  internalErrorResponse,
  meetingActionSchema,
  parseData,
  parseJsonBody,
  slugParamsSchema,
} from "@/lib/validation";

async function bestEffortDeleteLiveKitRoom(roomName: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const host = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !host) return;

  try {
    const svc = new RoomServiceClient(host, apiKey, apiSecret);
    await svc.deleteRoom(roomName);
  } catch (err) {
    // Room may already be empty / missing — never block ending the meeting.
    console.error("LiveKit deleteRoom best-effort failed:", err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community } = access;

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    const bodyResult = await parseJsonBody(request, meetingActionSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const body = bodyResult.data;

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

      if (error) return internalErrorResponse("Error al crear reunión:", error);
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

      if (!meeting) {
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }

      if (meeting.status === "ended") {
        return NextResponse.json(
          { error: "Esta reunión ya finalizó." },
          { status: 410 }
        );
      }

      const isHost = meeting.host_id === user.id || admin;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        return NextResponse.json(
          {
            error:
              "LiveKit no configurado. Definí LIVEKIT_API_KEY y LIVEKIT_API_SECRET.",
          },
          { status: 503 }
        );
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

    if (body.action === "start" || body.action === "end") {
      const supabase = await createClient();
      const { data: meeting } = await supabase
        .from("meetings")
        .select("id, host_id, status, livekit_room")
        .eq("id", body.meetingId)
        .eq("community_id", community.id)
        .maybeSingle();

      if (!meeting) {
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }

      const canControl = admin || meeting.host_id === user.id;
      if (!canControl) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      if (body.action === "start") {
        if (meeting.status === "ended") {
          return NextResponse.json(
            { error: "No se puede iniciar una reunión finalizada." },
            { status: 409 }
          );
        }
        const { error } = await supabase
          .from("meetings")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", meeting.id)
          .eq("community_id", community.id);
        if (error) return internalErrorResponse("Error al iniciar reunión:", error);
        return NextResponse.json({ success: true });
      }

      if (meeting.status === "ended") {
        return NextResponse.json({ success: true });
      }

      const { error } = await supabase
        .from("meetings")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", meeting.id)
        .eq("community_id", community.id);
      if (error) return internalErrorResponse("Error al finalizar reunión:", error);

      if (meeting.livekit_room) {
        await bestEffortDeleteLiveKitRoom(meeting.livekit_room);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    return internalErrorResponse("POST /api/c/[slug]/meetings failed:", err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const paramsResult = parseData(slugParamsSchema, await params);
  if ("error" in paramsResult) return paramsResult.error;
  const { slug } = paramsResult.data;

  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { community } = access;

  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, host:profiles(id, full_name), active_book:books(id, title)")
    .eq("community_id", community.id)
    .neq("status", "ended")
    .order("created_at", { ascending: false });

  return NextResponse.json({ meetings: meetings || [] });
}
