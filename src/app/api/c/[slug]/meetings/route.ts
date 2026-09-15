import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { decideMeetingTokenAccess } from "@/lib/meetings/token-access";
import {
  internalErrorResponse,
  meetingActionSchema,
  parseData,
  parseJsonBody,
  slugParamsSchema,
} from "@/lib/validation";

/** Max non-host camera publishers per meeting. */
export const MAX_GUEST_CAMERA_GRANTS = 2;

async function bestEffortDeleteLiveKitRoom(roomName: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const host = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !host) return;

  try {
    const svc = new RoomServiceClient(host, apiKey, apiSecret);
    await svc.deleteRoom(roomName);
  } catch (err) {
    console.error("LiveKit deleteRoom best-effort failed:", err);
  }
}

async function issueLiveKitToken(params: {
  userId: string;
  displayName: string;
  roomName: string;
  canPublish: boolean;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return null;
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.userId,
    name: params.displayName,
  });

  at.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: params.canPublish,
    canSubscribe: true,
  });

  return at.toJwt();
}

function bookHasReadableContent(book: {
  pdf_storage_path?: string | null;
  content_json?: unknown;
  has_pdf?: boolean | null;
}): boolean {
  if (book.has_pdf === true) return true;
  if (book.pdf_storage_path) return true;
  return Array.isArray(book.content_json) && book.content_json.length > 0;
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
          book_display_mode: body.activeBookId ? "cover" : "none",
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
        .select(
          "*, active_book:books(id, title, author, cover_url, pdf_storage_path, content_json, total_pages, table_of_contents, pipeline_version, pack_metrics)"
        )
        .eq("id", meetingId)
        .eq("community_id", community.id)
        .single();

      if (!meeting) {
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }

      const accessDecision = decideMeetingTokenAccess({
        status: meeting.status,
        hostId: meeting.host_id,
        userId: user.id,
        isAdmin: admin,
      });

      if (!accessDecision.ok) {
        return NextResponse.json(
          { error: accessDecision.error },
          { status: accessDecision.httpStatus }
        );
      }

      const isHost = accessDecision.isHost;

      if (accessDecision.shouldStart) {
        const { error: startError } = await supabase
          .from("meetings")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("id", meeting.id)
          .eq("community_id", community.id);
        if (startError) {
          return internalErrorResponse("Error al iniciar reunión:", startError);
        }
      }

      const { data: grant } = await supabase
        .from("meeting_camera_grants")
        .select("id")
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const canPublish = isHost || Boolean(grant);

      const token = await issueLiveKitToken({
        userId: user.id,
        displayName: user.full_name || user.email,
        roomName: meeting.livekit_room,
        canPublish,
      });

      if (!token) {
        return NextResponse.json(
          {
            error:
              "LiveKit no configurado. Definí LIVEKIT_API_KEY y LIVEKIT_API_SECRET.",
          },
          { status: 503 }
        );
      }

      const { count } = await supabase
        .from("meeting_camera_grants")
        .select("id", { count: "exact", head: true })
        .eq("meeting_id", meeting.id);

      return NextResponse.json({
        token,
        room: meeting.livekit_room,
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        isHost,
        canPublish,
        hasCameraGrant: Boolean(grant),
        guestCameraSlotsUsed: count ?? 0,
        guestCameraSlotsMax: MAX_GUEST_CAMERA_GRANTS,
        meeting: {
          ...meeting,
          status: accessDecision.shouldStart ? "live" : meeting.status,
        },
      });
    }

    if (body.action === "set-book") {
      const supabase = await createClient();
      const { data: meeting } = await supabase
        .from("meetings")
        .select("id, host_id, status, community_id")
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

      if (meeting.status === "ended") {
        return NextResponse.json(
          { error: "La reunión ya finalizó." },
          { status: 409 }
        );
      }

      let activeBookId: string | null = null;
      let bookDisplayMode: "none" | "cover" | "reader" = "none";
      let activeBook = null;

      if (body.displayMode === "none" || !body.bookId) {
        activeBookId = null;
        bookDisplayMode = "none";
      } else {
        const { data: book } = await supabase
          .from("books")
          .select(
            "id, title, author, cover_url, pdf_storage_path, content_json, total_pages, table_of_contents, pipeline_version, pack_metrics, is_published, community_id, allows_live_display"
          )
          .eq("id", body.bookId)
          .eq("community_id", community.id)
          .maybeSingle();

        if (!book) {
          return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
        }

        if (book.allows_live_display === false) {
          return NextResponse.json(
            { error: "Este libro no permite exhibición en vivo." },
            { status: 403 }
          );
        }

        if (body.displayMode === "cover") {
          if (!book.cover_url) {
            return NextResponse.json(
              { error: "Este libro no tiene portada." },
              { status: 400 }
            );
          }
          activeBookId = book.id;
          bookDisplayMode = "cover";
          activeBook = book;
        } else {
          if (!bookHasReadableContent(book)) {
            return NextResponse.json(
              {
                error:
                  "Este título es solo ficha: no tiene PDF para abrir el libro. Usá Solo portada.",
              },
              { status: 400 }
            );
          }
          activeBookId = book.id;
          bookDisplayMode = "reader";
          activeBook = book;
        }
      }

      // service_role: meetings UPDATE is admin-only in RLS; host may not be admin.
      const service = await createServiceClient();
      const { data: updated, error } = await service
        .from("meetings")
        .update({
          active_book_id: activeBookId,
          book_display_mode: bookDisplayMode,
        })
        .eq("id", meeting.id)
        .eq("community_id", community.id)
        .select(
          "*, active_book:books(id, title, author, cover_url, pdf_storage_path, content_json, total_pages, table_of_contents, pipeline_version, pack_metrics)"
        )
        .single();

      if (error) {
        return internalErrorResponse("Error al actualizar libro de la sala:", error);
      }

      return NextResponse.json({
        meeting: updated ?? {
          ...meeting,
          active_book_id: activeBookId,
          book_display_mode: bookDisplayMode,
          active_book: activeBook,
        },
      });
    }

    if (
      body.action === "grant-camera" ||
      body.action === "revoke-camera" ||
      body.action === "release-camera"
    ) {
      const supabase = await createClient();
      const { data: meeting } = await supabase
        .from("meetings")
        .select("id, host_id, status, livekit_room, community_id")
        .eq("id", body.meetingId)
        .eq("community_id", community.id)
        .maybeSingle();

      if (!meeting) {
        return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
      }

      if (meeting.status !== "live") {
        return NextResponse.json(
          { error: "La reunión tiene que estar en vivo para gestionar cámaras." },
          { status: 409 }
        );
      }

      const isHost = meeting.host_id === user.id || admin;
      const meetingId = meeting.id;
      const livekitRoom = meeting.livekit_room;
      const hostId = meeting.host_id;

      async function grantCounts() {
        const { count } = await supabase
          .from("meeting_camera_grants")
          .select("id", { count: "exact", head: true })
          .eq("meeting_id", meetingId);
        return count ?? 0;
      }

      if (body.action === "release-camera") {
        // Guest drops their own grant (host keeps publish rights).
        if (!isHost) {
          await supabase
            .from("meeting_camera_grants")
            .delete()
            .eq("meeting_id", meetingId)
            .eq("user_id", user.id);
        }

        const canPublish = isHost;
        const token = await issueLiveKitToken({
          userId: user.id,
          displayName: user.full_name || user.email,
          roomName: livekitRoom,
          canPublish,
        });
        if (!token) {
          return NextResponse.json(
            { error: "LiveKit no configurado." },
            { status: 503 }
          );
        }

        return NextResponse.json({
          token,
          canPublish,
          hasCameraGrant: false,
          guestCameraSlotsUsed: await grantCounts(),
          guestCameraSlotsMax: MAX_GUEST_CAMERA_GRANTS,
        });
      }

      // grant-camera / revoke-camera — host only
      if (!isHost) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      if (body.targetUserId === user.id || body.targetUserId === hostId) {
        return NextResponse.json(
          { error: "La conductora ya publica cámara." },
          { status: 400 }
        );
      }

      if (body.action === "revoke-camera") {
        const service = await createServiceClient();
        await service
          .from("meeting_camera_grants")
          .delete()
          .eq("meeting_id", meetingId)
          .eq("user_id", body.targetUserId);

        return NextResponse.json({
          success: true,
          targetUserId: body.targetUserId,
          hasCameraGrant: false,
          guestCameraSlotsUsed: await grantCounts(),
          guestCameraSlotsMax: MAX_GUEST_CAMERA_GRANTS,
        });
      }

      // grant-camera
      const { data: existing } = await supabase
        .from("meeting_camera_grants")
        .select("id")
        .eq("meeting_id", meetingId)
        .eq("user_id", body.targetUserId)
        .maybeSingle();

      if (!existing) {
        const used = await grantCounts();
        if (used >= MAX_GUEST_CAMERA_GRANTS) {
          return NextResponse.json(
            {
              error:
                "Ya hay 2 cámaras de invitadas. Quitá una antes de dar otra.",
            },
            { status: 409 }
          );
        }

        const service = await createServiceClient();
        const { error: insertError } = await service
          .from("meeting_camera_grants")
          .insert({
            meeting_id: meetingId,
            user_id: body.targetUserId,
          });

        if (insertError) {
          return internalErrorResponse("Error al dar cámara:", insertError);
        }
      }

      return NextResponse.json({
        success: true,
        targetUserId: body.targetUserId,
        hasCameraGrant: true,
        guestCameraSlotsUsed: await grantCounts(),
        guestCameraSlotsMax: MAX_GUEST_CAMERA_GRANTS,
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

      const service = await createServiceClient();
      const { error } = await service
        .from("meetings")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          active_book_id: null,
          book_display_mode: "none",
        })
        .eq("id", meeting.id)
        .eq("community_id", community.id);
      if (error) return internalErrorResponse("Error al finalizar reunión:", error);

      await service.from("meeting_camera_grants").delete().eq("meeting_id", meeting.id);

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
    .select(
      "*, host:profiles(id, full_name), active_book:books(id, title, author, cover_url)"
    )
    .eq("community_id", community.id)
    .neq("status", "ended")
    .order("created_at", { ascending: false });

  return NextResponse.json({ meetings: meetings || [] });
}
