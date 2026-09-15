"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  isTrackReference,
  useRemoteParticipants,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { ArrowLeft, BookOpen, ImageIcon, MessageSquare, Send, Video, VideoOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BookReader } from "@/components/library/book-reader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PIPELINE_VERSION, type PackMetrics } from "@/lib/pdf/paginator";
import type {
  Book,
  BookPage,
  BookTOCItem,
  Meeting,
  MeetingBookDisplayMode,
  MeetingChatMessage,
} from "@/lib/types/database";
import { MeetingNotice } from "@/components/legal/meeting-notice";

interface MeetingRoomClientProps {
  slug: string;
  isAdmin: boolean;
}

function bookHasReadableContent(book: Book): boolean {
  if (book.has_pdf === true) return true;
  if (book.pdf_storage_path) return true;
  return Array.isArray(book.content_json) && book.content_json.length > 0;
}

function CameraTileSlot({
  label,
  trackRef,
  className,
}: {
  label: string;
  trackRef?: ReturnType<typeof useTracks>[number];
  className?: string;
}) {
  const hasVideo =
    trackRef &&
    isTrackReference(trackRef) &&
    Boolean(
      trackRef.publication?.track ||
        (trackRef.participant.isLocal && trackRef.publication)
    );

  return (
    <div
      className={`relative aspect-video w-full min-h-[11rem] shrink-0 overflow-hidden rounded-lg border border-border bg-surface ${className ?? ""}`}
    >
      {hasVideo && isTrackReference(trackRef) ? (
        <ParticipantTile
          trackRef={trackRef}
          className="absolute inset-0 !h-full !w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
          <Video className="h-4 w-4 text-muted" />
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {label}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Wireframe layout — left column:
 * conductor cam → guest cams → user controls
 */
function MeetingCameraColumn({
  canPublish,
  hostUserId,
  showHostControls,
  grantedUserIds,
  slotsUsed,
  slotsMax,
  busy,
  onGrant,
  onRevoke,
}: {
  canPublish: boolean;
  hostUserId: string;
  showHostControls: boolean;
  grantedUserIds: Set<string>;
  slotsUsed: number;
  slotsMax: number;
  busy: boolean;
  onGrant: (userId: string) => void;
  onRevoke: (userId: string) => void;
}) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false }
  );

  const live = tracks.filter(isTrackReference).filter((t) => {
    const pub = t.publication;
    if (!pub) return false;
    // Local cam can be "on" before track is fully attached; still show the tile.
    if (t.participant.isLocal) {
      return !pub.isMuted || Boolean(pub.track);
    }
    return Boolean(pub.track);
  });

  const hostTrack =
    live.find((t) => t.participant.identity === hostUserId) ??
    live.find((t) => t.participant.isLocal);
  const otherTracks = live
    .filter((t) => t.participant.identity !== hostTrack?.participant.identity)
    .slice(0, 2);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 border-b border-border p-2 lg:h-full lg:w-[calc(30%+10px)] lg:max-w-[330px] lg:border-b-0 lg:border-r xl:w-[calc(28%+10px)]">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <CameraTileSlot label="Cámara de conductora" trackRef={hostTrack} />
        <CameraTileSlot label="Cámara de invitada" trackRef={otherTracks[0]} />
        <CameraTileSlot label="Cámara de invitada" trackRef={otherTracks[1]} />
      </div>

      <div className="meeting-livekit shrink-0 grow-0 overflow-visible rounded-lg border border-border bg-background">
        <p className="border-b border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Configuración
        </p>
        {canPublish ? (
          <ControlBar
            variation="minimal"
            controls={{
              camera: true,
              microphone: true,
              screenShare: false,
              chat: false,
              leave: false,
            }}
          />
        ) : (
          <p className="px-2 py-2 text-[11px] text-muted">
            Oyente — la conductora puede darte cámara
          </p>
        )}
        {showHostControls ? (
          <HostGuestCameraControls
            grantedUserIds={grantedUserIds}
            slotsUsed={slotsUsed}
            slotsMax={slotsMax}
            busy={busy}
            onGrant={onGrant}
            onRevoke={onRevoke}
          />
        ) : null}
      </div>
    </aside>
  );
}

function HostGuestCameraControls({
  grantedUserIds,
  slotsUsed,
  slotsMax,
  busy,
  onGrant,
  onRevoke,
}: {
  grantedUserIds: Set<string>;
  slotsUsed: number;
  slotsMax: number;
  busy: boolean;
  onGrant: (userId: string) => void;
  onRevoke: (userId: string) => void;
}) {
  const remotes = useRemoteParticipants();

  if (remotes.length === 0) {
    return (
      <p className="border-t border-border px-2 py-1.5 text-[10px] text-muted">
        Nadie más en la sala.
      </p>
    );
  }

  return (
    <ul className="max-h-24 space-y-1 overflow-y-auto border-t border-border px-1.5 py-1.5">
      {remotes.map((p) => {
        const uid = p.identity;
        const name = p.name || uid.slice(0, 8);
        const hasGrant = grantedUserIds.has(uid);
        return (
          <li
            key={uid}
            className="flex items-center justify-between gap-1 rounded-md border border-border bg-surface px-1.5 py-1"
          >
            <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
              {name}
            </span>
            {hasGrant ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={busy}
                onClick={() => onRevoke(uid)}
              >
                <VideoOff className="h-3 w-3" />
                Quitar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={busy || slotsUsed >= slotsMax}
                onClick={() => onGrant(uid)}
              >
                <Video className="h-3 w-3" />
                Dar
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MeetingRoomClient({ slug, isAdmin }: MeetingRoomClientProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [listError, setListError] = useState("");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [hasCameraGrant, setHasCameraGrant] = useState(false);
  const [guestSlotsUsed, setGuestSlotsUsed] = useState(0);
  const [guestSlotsMax, setGuestSlotsMax] = useState(2);
  const [grantedUserIds, setGrantedUserIds] = useState<string[]>([]);
  const [cameraActionError, setCameraActionError] = useState("");
  const [cameraBusy, setCameraBusy] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingMeeting, setPendingMeeting] = useState<Meeting | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [stageBook, setStageBook] = useState<Book | null>(null);
  const [displayMode, setDisplayMode] = useState<MeetingBookDisplayMode>("none");
  const [showBooks, setShowBooks] = useState(false);
  const [pendingPick, setPendingPick] = useState<Book | null>(null);
  const [bookActionError, setBookActionError] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeChatRef = useRef<(() => void) | null>(null);
  const unsubscribeStageRef = useRef<(() => void) | null>(null);
  const canPublishRef = useRef(false);
  const hasCameraGrantRef = useRef(false);
  canPublishRef.current = canPublish;
  hasCameraGrantRef.current = hasCameraGrant;

  const canControlStage = isHost || isAdmin;
  const stageOpen = displayMode === "cover" || displayMode === "reader";

  useEffect(() => {
    loadMeetings();
    loadBooks();
  }, [slug]);

  async function loadMeetings() {
    setLoadingMeetings(true);
    setListError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMeetings([]);
        setListError(data.error || "No se pudieron cargar las reuniones.");
        return;
      }
      setMeetings(data.meetings || []);
    } catch {
      setMeetings([]);
      setListError(
        "No se pudieron cargar las reuniones. Revisá tu conexión e intentá de nuevo."
      );
    } finally {
      setLoadingMeetings(false);
    }
  }

  async function loadBooks() {
    const res = await fetch(`/api/c/${slug}/books`);
    const payload = await res.json();
    setBooks(payload.books || []);
  }

  function applyStageFromMeeting(meeting: Meeting) {
    const mode = (meeting.book_display_mode ?? "none") as MeetingBookDisplayMode;
    setDisplayMode(mode);
    if (mode === "none" || !meeting.active_book) {
      setStageBook(null);
      return;
    }
    setStageBook(meeting.active_book as Book);
  }

  async function requestJoin(meeting: Meeting) {
    setPendingMeeting(meeting);
  }

  async function joinMeeting(meeting: Meeting) {
    setPendingMeeting(null);
    setJoinError("");
    setJoiningId(meeting.id);
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "token", meetingId: meeting.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setJoinError(
          "Las videollamadas no están disponibles: LiveKit no está configurado en este entorno. Pedile a quien administra la plataforma que defina LIVEKIT_API_KEY, LIVEKIT_API_SECRET y NEXT_PUBLIC_LIVEKIT_URL."
        );
        return;
      }

      if (!res.ok || !data.token || typeof data.token !== "string") {
        setJoinError(
          data.error || "No se pudo unir a la reunión. Intentá de nuevo."
        );
        return;
      }

      setToken(data.token);
      setLivekitUrl(data.url || "");
      setIsHost(Boolean(data.isHost));
      setCanPublish(Boolean(data.canPublish ?? data.isHost));
      setHasCameraGrant(Boolean(data.hasCameraGrant));
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? 0));
      setGuestSlotsMax(Number(data.guestCameraSlotsMax ?? 2));

      const joined = (data.meeting as Meeting) || {
        ...meeting,
        status: "live" as const,
      };
      setActiveMeeting(joined);
      applyStageFromMeeting(joined);
    } catch {
      setJoinError(
        "No se pudo unir a la reunión. Revisá tu conexión e intentá de nuevo."
      );
    } finally {
      setJoiningId(null);
    }
  }

  useEffect(() => {
    unsubscribeChatRef.current?.();
    unsubscribeChatRef.current = null;
    unsubscribeStageRef.current?.();
    unsubscribeStageRef.current = null;

    if (!activeMeeting) return;

    const meetingId = activeMeeting.id;
    const supabase = createClient();

    supabase
      .from("meeting_chat_messages")
      .select("*, profile:profiles(id, full_name)")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setChatMessages(data || []));

    const chatChannel = supabase
      .channel(`meeting-chat-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_chat_messages",
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", payload.new.user_id)
            .single();

          setChatMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [
              ...prev,
              {
                ...(payload.new as MeetingChatMessage),
                profile: profile
                  ? { id: profile.id, full_name: profile.full_name }
                  : undefined,
              },
            ];
          });
        }
      )
      .subscribe();

    const stageChannel = supabase
      .channel(`meeting-stage-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meetings",
          filter: `id=eq.${meetingId}`,
        },
        async (payload) => {
          const row = payload.new as Meeting;
          const mode = (row.book_display_mode ?? "none") as MeetingBookDisplayMode;
          setDisplayMode(mode);
          setActiveMeeting((prev) =>
            prev
              ? {
                  ...prev,
                  active_book_id: row.active_book_id,
                  book_display_mode: mode,
                  status: row.status,
                }
              : prev
          );

          if (mode === "none" || !row.active_book_id) {
            setStageBook(null);
            return;
          }

          const { data: book } = await supabase
            .from("books")
            .select(
              "id, title, author, cover_url, pdf_storage_path, content_json, total_pages, table_of_contents, pipeline_version, pack_metrics, community_id, is_published, created_at, updated_at, description"
            )
            .eq("id", row.active_book_id)
            .maybeSingle();

          if (book) setStageBook(book as Book);
        }
      )
      .subscribe();

    async function loadGrants() {
      const { data } = await supabase
        .from("meeting_camera_grants")
        .select("user_id")
        .eq("meeting_id", meetingId);
      const ids = (data || []).map((g) => g.user_id as string);
      setGrantedUserIds(ids);
      setGuestSlotsUsed(ids.length);
    }

    void loadGrants();

    const grantsChannel = supabase
      .channel(`meeting-grants-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_camera_grants",
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          void loadGrants();
          void refreshLiveKitToken(meetingId);
        }
      )
      .subscribe();

    unsubscribeChatRef.current = () => {
      void supabase.removeChannel(chatChannel);
    };
    unsubscribeStageRef.current = () => {
      void supabase.removeChannel(stageChannel);
      void supabase.removeChannel(grantsChannel);
    };

    return () => {
      unsubscribeChatRef.current?.();
      unsubscribeChatRef.current = null;
      unsubscribeStageRef.current?.();
      unsubscribeStageRef.current = null;
    };
  }, [activeMeeting?.id, slug]);

  // Fallback if Realtime on grants is slow/off: guest picks up host grant.
  useEffect(() => {
    if (!activeMeeting || isHost) return;
    const id = activeMeeting.id;
    const timer = window.setInterval(() => {
      void refreshLiveKitToken(id);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeMeeting?.id, isHost]);

  async function refreshLiveKitToken(meetingId: string) {
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "token", meetingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) return;
      const nextPublish = Boolean(data.canPublish ?? data.isHost);
      const nextGrant = Boolean(data.hasCameraGrant);
      const permissionsChanged =
        nextPublish !== canPublishRef.current ||
        nextGrant !== hasCameraGrantRef.current;
      if (permissionsChanged) {
        setToken(data.token);
      }
      setCanPublish(nextPublish);
      setHasCameraGrant(nextGrant);
      setIsHost(Boolean(data.isHost));
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? 0));
      setGuestSlotsMax(Number(data.guestCameraSlotsMax ?? 2));
    } catch {
      /* ignore transient refresh errors */
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMeeting || !chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("meeting_chat_messages").insert({
      meeting_id: activeMeeting.id,
      user_id: user.id,
      content,
    });
  }

  async function createMeeting() {
    const res = await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", title: "Reunión en vivo" }),
    });
    if (res.ok) await loadMeetings();
  }

  async function startMeeting() {
    if (!activeMeeting) return;
    await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", meetingId: activeMeeting.id }),
    });
    setActiveMeeting({ ...activeMeeting, status: "live" });
  }

  async function endMeeting() {
    if (!activeMeeting) return;
    await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", meetingId: activeMeeting.id }),
    });
    leaveMeeting();
    await loadMeetings();
  }

  function leaveMeeting() {
    unsubscribeChatRef.current?.();
    unsubscribeChatRef.current = null;
    unsubscribeStageRef.current?.();
    unsubscribeStageRef.current = null;
    setActiveMeeting(null);
    setToken(null);
    setStageBook(null);
    setDisplayMode("none");
    setShowBooks(false);
    setPendingPick(null);
    setChatMessages([]);
    setChatInput("");
    setIsHost(false);
    setCanPublish(false);
    setHasCameraGrant(false);
    setGuestSlotsUsed(0);
    setGrantedUserIds([]);
    setCameraActionError("");
    setBookActionError("");
    setMobileChatOpen(false);
  }

  async function setMeetingBook(
    bookId: string | null,
    mode: MeetingBookDisplayMode
  ) {
    if (!activeMeeting) return;
    setBookBusy(true);
    setBookActionError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-book",
          meetingId: activeMeeting.id,
          bookId,
          displayMode: mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBookActionError(data.error || "No se pudo actualizar el libro.");
        return;
      }
      if (data.meeting) {
        setActiveMeeting(data.meeting);
        applyStageFromMeeting(data.meeting);
      }
      setPendingPick(null);
      setShowBooks(false);
    } catch {
      setBookActionError("No se pudo actualizar el libro. Revisá tu conexión.");
    } finally {
      setBookBusy(false);
    }
  }

  async function grantCamera(targetUserId: string) {
    if (!activeMeeting) return;
    setCameraBusy(true);
    setCameraActionError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant-camera",
          meetingId: activeMeeting.id,
          targetUserId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCameraActionError(data.error || "No se pudo dar la cámara.");
        return;
      }
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? guestSlotsUsed));
      setGrantedUserIds((prev) =>
        prev.includes(targetUserId) ? prev : [...prev, targetUserId]
      );
    } catch {
      setCameraActionError("No se pudo dar la cámara. Revisá tu conexión.");
    } finally {
      setCameraBusy(false);
    }
  }

  async function revokeCamera(targetUserId: string) {
    if (!activeMeeting) return;
    setCameraBusy(true);
    setCameraActionError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke-camera",
          meetingId: activeMeeting.id,
          targetUserId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCameraActionError(data.error || "No se pudo quitar la cámara.");
        return;
      }
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? 0));
      setGrantedUserIds((prev) => prev.filter((id) => id !== targetUserId));
    } catch {
      setCameraActionError("No se pudo quitar la cámara. Revisá tu conexión.");
    } finally {
      setCameraBusy(false);
    }
  }

  async function releaseCamera() {
    if (!activeMeeting) return;
    setCameraBusy(true);
    setCameraActionError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release-camera",
          meetingId: activeMeeting.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setCameraActionError(
          data.error || "No se pudo soltar la cámara. Intentá de nuevo."
        );
        return;
      }
      setToken(data.token);
      setCanPublish(Boolean(data.canPublish));
      setHasCameraGrant(Boolean(data.hasCameraGrant));
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? 0));
      setGuestSlotsMax(Number(data.guestCameraSlotsMax ?? guestSlotsMax));
    } catch {
      setCameraActionError("No se pudo soltar la cámara. Revisá tu conexión.");
    } finally {
      setCameraBusy(false);
    }
  }

  function renderChatPanel(opts?: { className?: string }) {
    return (
      <div
        className={`flex min-h-0 flex-1 flex-col bg-background ${opts?.className ?? ""}`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Chat en vivo</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {chatMessages.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay mensajes.</p>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className="mb-3 rounded-md border border-border bg-surface px-2.5 py-2"
              >
                <p className="text-xs font-semibold text-foreground">
                  {msg.profile?.full_name || "Usuario"}
                </p>
                <p className="mt-0.5 text-sm text-foreground/90">{msg.content}</p>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form
          onSubmit={sendChat}
          className="shrink-0 border-t border-border bg-background p-3"
        >
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Escribe un mensaje..."
            />
            <Button type="submit" size="icon" aria-label="Enviar mensaje">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (activeMeeting && token) {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/c/${slug}/forum`}>
                <ArrowLeft className="h-4 w-4" />
                Comunidad
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeMeeting.title}
              </p>
              <p className="text-xs text-muted">
                Sala en vivo · {guestSlotsUsed}/{guestSlotsMax} cámaras invitadas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canControlStage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowBooks(!showBooks);
                  setPendingPick(null);
                }}
              >
                <BookOpen className="h-4 w-4" />
                Elegir libro
              </Button>
            )}
            {canControlStage && stageOpen && (
              <Button
                variant="outline"
                size="sm"
                disabled={bookBusy}
                onClick={() => void setMeetingBook(null, "none")}
              >
                Cerrar escenario
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileChatOpen(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
            {!isHost && hasCameraGrant && (
              <Button
                variant="outline"
                size="sm"
                disabled={cameraBusy}
                onClick={() => void releaseCamera()}
              >
                Soltar cámara
              </Button>
            )}
            {(isAdmin || isHost) && activeMeeting.status !== "ended" && (
              <>
                {activeMeeting.status !== "live" && (
                  <Button size="sm" onClick={startMeeting}>
                    Iniciar transmisión
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void endMeeting()}
                >
                  Finalizar reunión
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={leaveMeeting}>
              Salir
            </Button>
          </div>
        </div>

        {(cameraActionError || bookActionError) && (
          <p className="shrink-0 border-b border-border bg-accent-light px-3 py-2 text-sm text-foreground">
            {cameraActionError || bookActionError}
          </p>
        )}

        {showBooks && canControlStage && (
          <div className="shrink-0 border-b border-border bg-background px-3 py-3">
            {pendingPick ? (
              <div className="mx-auto flex max-w-xl flex-col gap-3 rounded-md border border-border bg-surface p-4">
                <div className="flex gap-3">
                  {pendingPick.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingPick.cover_url}
                      alt=""
                      className="h-24 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center rounded bg-background text-muted">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{pendingPick.title}</p>
                    {pendingPick.author ? (
                      <p className="text-sm text-muted">{pendingPick.author}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      {bookHasReadableContent(pendingPick)
                        ? "Tiene PDF: podés abrir portada o el libro."
                        : "Solo ficha: disponible Solo portada."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={bookBusy || !pendingPick.cover_url}
                    onClick={() =>
                      void setMeetingBook(pendingPick.id, "cover")
                    }
                  >
                    <ImageIcon className="h-4 w-4" />
                    Solo portada
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bookBusy || !bookHasReadableContent(pendingPick)}
                    onClick={() =>
                      void setMeetingBook(pendingPick.id, "reader")
                    }
                  >
                    <BookOpen className="h-4 w-4" />
                    Abrir libro
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={bookBusy}
                    onClick={() => setPendingPick(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {books.length === 0 ? (
                  <p className="py-1 text-sm text-muted">
                    No hay libros en la biblioteca.
                  </p>
                ) : (
                  books.map((book) => (
                    <Button
                      key={book.id}
                      variant={
                        stageBook?.id === book.id ? "default" : "outline"
                      }
                      size="sm"
                      className="shrink-0"
                      onClick={() => setPendingPick(book)}
                    >
                      {book.title}
                    </Button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <LiveKitRoom
          key={token}
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          video={canPublish}
          audio={canPublish}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onDisconnected={leaveMeeting}
        >
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <MeetingCameraColumn
              canPublish={canPublish}
              hostUserId={activeMeeting.host_id}
              showHostControls={canControlStage}
              grantedUserIds={new Set(grantedUserIds)}
              slotsUsed={guestSlotsUsed}
              slotsMax={guestSlotsMax}
              busy={cameraBusy}
              onGrant={(id) => void grantCamera(id)}
              onRevoke={(id) => void revokeCamera(id)}
            />

            {/* Derecha: libro/portada arriba + chat abajo */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2">
              <div className="flex min-h-0 flex-[1.45] flex-col overflow-hidden rounded-lg border border-border bg-[#0c1727]">
                {displayMode === "cover" && stageBook ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
                    <div className="flex max-h-full max-w-lg flex-col items-center gap-3">
                      {stageBook.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={stageBook.cover_url}
                          alt={stageBook.title}
                          className="max-h-full w-auto max-w-full rounded-md object-contain shadow-lg"
                        />
                      ) : (
                        <div className="flex h-64 w-44 items-center justify-center rounded-md bg-white/10 text-white/70">
                          Sin portada
                        </div>
                      )}
                      <div className="text-center text-white">
                        <p className="text-base font-semibold">{stageBook.title}</p>
                        {stageBook.author ? (
                          <p className="text-sm text-white/70">{stageBook.author}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : displayMode === "reader" && stageBook ? (
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <BookReader
                      title={stageBook.title}
                      author={stageBook.author}
                      pages={(stageBook.content_json as BookPage[]) || []}
                      tableOfContents={
                        (stageBook.table_of_contents as BookTOCItem[]) || []
                      }
                      pipelineVersion={stageBook.pipeline_version ?? 0}
                      packMetrics={
                        (stageBook.pack_metrics as PackMetrics | null) ?? null
                      }
                      compact
                      fillWidth
                      onDomPacked={async (packed, metrics) => {
                        setStageBook((prev) =>
                          prev
                            ? {
                                ...prev,
                                content_json: packed as BookPage[],
                                total_pages: packed.length,
                                pipeline_version: PIPELINE_VERSION,
                                pack_metrics: metrics,
                              }
                            : prev
                        );
                        try {
                          await fetch(
                            `/api/c/${slug}/books/${stageBook.id}/paginate`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                pages: packed,
                                packMetrics: metrics,
                                force: true,
                              }),
                            }
                          );
                        } catch (err) {
                          console.error("meeting paginate persist failed", err);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
                    <BookOpen className="h-10 w-10 text-white/50" />
                    <p className="text-sm font-semibold">
                      Portada o libro abierto
                    </p>
                    <p className="max-w-sm text-xs text-white/65">
                      {canControlStage
                        ? "Elegí un libro arriba para mostrar la portada o abrir el lector."
                        : "La conductora todavía no abrió el escenario."}
                    </p>
                    {canControlStage ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowBooks(true)}
                      >
                        <BookOpen className="h-4 w-4" />
                        Elegir libro
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="hidden min-h-[11rem] flex-1 overflow-hidden rounded-lg border border-border lg:flex">
                {renderChatPanel()}
              </div>
            </section>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>

        {mobileChatOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-foreground/40"
              aria-label="Cerrar chat"
              onClick={() => setMobileChatOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 flex h-[70vh] flex-col border-t border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-semibold">Chat</p>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border"
                  onClick={() => setMobileChatOpen(false)}
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderChatPanel()}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/c/${slug}/forum`}>
              <ArrowLeft className="h-4 w-4" />
              Comunidad
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sala de reuniones</h1>
            <p className="text-sm text-muted">Video en vivo con lectura y chat</p>
          </div>
        </div>
        {isAdmin && <Button onClick={createMeeting}>Crear reunión</Button>}
      </div>

      {joinError && (
        <Card className="mb-4 border-red-200 hard-shadow-sm" role="alert">
          <CardContent className="py-4 text-sm text-red-700">{joinError}</CardContent>
        </Card>
      )}

      {loadingMeetings ? (
        <Card className="hard-shadow-sm">
          <CardContent className="py-12 text-center text-muted">
            Cargando reuniones…
          </CardContent>
        </Card>
      ) : listError ? (
        <Card className="hard-shadow-sm">
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" onClick={() => loadMeetings()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : meetings.length === 0 ? (
        <Card className="hard-shadow-sm">
          <CardContent className="py-12 text-center text-muted">
            {isAdmin
              ? "Todavía no hay reuniones. Creá una para empezar la sala de lectura en vivo."
              : "No hay reuniones programadas por ahora. Volvé más tarde."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="hard-shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{meeting.title}</CardTitle>
                <p className="text-sm text-muted">
                  Estado:{" "}
                  <span
                    className={
                      meeting.status === "live"
                        ? "font-bold text-green-700"
                        : meeting.status === "ended"
                          ? "text-muted"
                          : "font-bold text-accent"
                    }
                  >
                    {meeting.status === "live"
                      ? "En vivo"
                      : meeting.status === "ended"
                        ? "Finalizada"
                        : "Programada"}
                  </span>
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => void requestJoin(meeting)}
                  disabled={joiningId === meeting.id}
                >
                  <Video className="h-4 w-4" />
                  {joiningId === meeting.id ? "Conectando…" : "Entrar a la sala"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {pendingMeeting && (
        <MeetingNotice
          onAccept={() => void joinMeeting(pendingMeeting)}
          onCancel={() => setPendingMeeting(null)}
        />
      )}
    </div>
  );
}
