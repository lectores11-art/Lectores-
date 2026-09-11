"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { ArrowLeft, BookOpen, ImageIcon, MessageSquare, Send, Video, X } from "lucide-react";
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

function MeetingCameraStack({
  canPublish,
  enlarge,
}: {
  canPublish: boolean;
  enlarge: boolean;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const cameraTracks = tracks
    .filter((t) => t.source === Track.Source.Camera)
    .slice(0, 3);
  const screenTracks = tracks.filter((t) => t.source === Track.Source.ScreenShare);
  const displayTracks = [...cameraTracks, ...screenTracks].slice(0, 4);

  return (
    <div className="meeting-livekit flex h-full min-h-0 flex-col">
      <div
        className={
          enlarge
            ? "grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1"
            : "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2"
        }
      >
        {displayTracks.length === 0 ? (
          <div
            className={
              enlarge
                ? "flex min-h-[12rem] flex-1 items-center justify-center rounded-md border border-border bg-surface text-sm text-muted"
                : "flex aspect-video items-center justify-center rounded-md border border-border bg-surface text-xs text-muted"
            }
          >
            Sin cámara
          </div>
        ) : (
          displayTracks.map((trackRef) => (
            <div
              key={`${trackRef.participant.identity}-${trackRef.source}`}
              className={
                enlarge
                  ? "relative min-h-[10rem] flex-1 overflow-hidden rounded-md border border-border bg-surface aspect-video lg:min-h-[11rem]"
                  : "relative aspect-video w-full shrink-0 overflow-hidden rounded-md border border-border bg-surface"
              }
            >
              <ParticipantTile trackRef={trackRef} className="h-full w-full" />
            </div>
          ))
        )}
      </div>
      <ControlBar
        variation="minimal"
        controls={{
          camera: canPublish,
          microphone: canPublish,
          screenShare: canPublish,
          chat: false,
          leave: false,
        }}
      />
    </div>
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

    unsubscribeChatRef.current = () => {
      void supabase.removeChannel(chatChannel);
    };
    unsubscribeStageRef.current = () => {
      void supabase.removeChannel(stageChannel);
    };

    return () => {
      unsubscribeChatRef.current?.();
      unsubscribeChatRef.current = null;
      unsubscribeStageRef.current?.();
      unsubscribeStageRef.current = null;
    };
  }, [activeMeeting?.id]);

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

  async function requestCamera() {
    if (!activeMeeting) return;
    setCameraBusy(true);
    setCameraActionError("");
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request-camera",
          meetingId: activeMeeting.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setCameraActionError(
          data.error || "No se pudo abrir la cámara. Intentá de nuevo."
        );
        return;
      }
      setToken(data.token);
      setCanPublish(Boolean(data.canPublish));
      setHasCameraGrant(Boolean(data.hasCameraGrant));
      setGuestSlotsUsed(Number(data.guestCameraSlotsUsed ?? guestSlotsUsed));
      setGuestSlotsMax(Number(data.guestCameraSlotsMax ?? guestSlotsMax));
    } catch {
      setCameraActionError("No se pudo abrir la cámara. Revisá tu conexión.");
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
            {!isHost &&
              (hasCameraGrant ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cameraBusy}
                  onClick={() => void releaseCamera()}
                >
                  Soltar cámara
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={cameraBusy || guestSlotsUsed >= guestSlotsMax}
                  onClick={() => void requestCamera()}
                >
                  <Video className="h-4 w-4" />
                  Pedir cámara
                </Button>
              ))}
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
            {/* Cámaras */}
            <aside
              className={
                stageOpen
                  ? "flex max-h-[36vh] w-full shrink-0 flex-col border-b border-border lg:max-h-none lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-[24rem]"
                  : "flex max-h-[50vh] min-w-0 flex-1 flex-col border-b border-border lg:max-h-none lg:border-b-0 lg:border-r"
              }
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-2.5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Cámaras
                </p>
                <span className="text-[11px] text-muted">
                  {isHost
                    ? "Conductora"
                    : hasCameraGrant
                      ? "En vivo"
                      : "Oyente"}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <MeetingCameraStack
                  canPublish={canPublish}
                  enlarge={!stageOpen}
                />
              </div>
            </aside>

            {/* Escenario + chat */}
            <section
              className={
                stageOpen
                  ? "flex min-h-0 min-w-0 flex-1 flex-col"
                  : "flex min-h-0 w-full shrink-0 flex-col lg:w-[20rem] xl:w-[22rem]"
              }
            >
              {stageOpen ? (
                <div className="flex min-h-0 flex-[1.65] flex-col bg-[#0c1727]">
                  {displayMode === "cover" && stageBook ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
                      <div className="flex max-h-full max-w-md flex-col items-center gap-3">
                        {stageBook.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stageBook.cover_url}
                            alt={stageBook.title}
                            className="max-h-[min(58vh,28rem)] w-auto max-w-full rounded-sm object-contain shadow-lg"
                          />
                        ) : (
                          <div className="flex h-64 w-44 items-center justify-center rounded bg-white/10 text-white/70">
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
                  ) : null}
                </div>
              ) : (
                <div className="hidden border-b border-border px-3 py-3 text-sm text-muted lg:block">
                  {canControlStage
                    ? "Elegí un libro para mostrar portada o abrir el lector."
                    : "La conductora aún no abrió un libro."}
                </div>
              )}

              <div
                className={
                  stageOpen
                    ? "hidden min-h-[12rem] flex-1 border-t border-border lg:flex"
                    : "hidden min-h-0 flex-1 lg:flex"
                }
              >
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
