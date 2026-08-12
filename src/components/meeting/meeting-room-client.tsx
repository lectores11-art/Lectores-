"use client";

import { useEffect, useRef, useState } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { BookOpen, MessageSquare, Send, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BookReader } from "@/components/library/book-reader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { PIPELINE_VERSION, type PackMetrics } from "@/lib/pdf/paginator";
import type { Book, BookPage, BookTOCItem, Meeting, MeetingChatMessage } from "@/lib/types/database";

interface MeetingRoomClientProps {
  slug: string;
  isAdmin: boolean;
}

function MeetingVideoStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="meeting-livekit flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      </div>
      <ControlBar
        variation="minimal"
        controls={{
          camera: true,
          microphone: true,
          screenShare: true,
          chat: false,
          leave: false,
        }}
      />
    </div>
  );
}

export function MeetingRoomClient({ slug, isAdmin }: MeetingRoomClientProps) {
  const { setSearchPlaceholder } = useDetailPanel();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [listError, setListError] = useState("");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showBooks, setShowBooks] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeChatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSearchPlaceholder("Buscar reuniones…");
  }, [setSearchPlaceholder]);

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
        setListError(
          data.error || "No se pudieron cargar las reuniones. Intentá de nuevo."
        );
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
    const data = await res.json();
    setBooks(data.books || []);
  }

  async function joinMeeting(meeting: Meeting) {
    setJoinError("");
    setJoiningId(meeting.id);
    try {
      const res = await fetch(`/api/c/${slug}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "token", meetingId: meeting.id }),
      });
      const data = await res.json().catch(() => ({}));

      // Never invent or fall back to demo tokens when LiveKit is unavailable.
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
      setActiveMeeting({ ...meeting, status: "live" });
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

    if (!activeMeeting) return;

    const meetingId = activeMeeting.id;
    const supabase = createClient();
    supabase
      .from("meeting_chat_messages")
      .select("*, profile:profiles(id, full_name)")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setChatMessages(data || []));

    const channel = supabase
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

    const unsubscribe = () => {
      supabase.removeChannel(channel);
    };
    unsubscribeChatRef.current = unsubscribe;

    return () => {
      unsubscribe();
      if (unsubscribeChatRef.current === unsubscribe) {
        unsubscribeChatRef.current = null;
      }
    };
  }, [activeMeeting?.id]);

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !activeMeeting) return;

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("meeting_chat_messages").insert({
      meeting_id: activeMeeting.id,
      user_id: user.id,
      content: chatInput.trim(),
    });
    setChatInput("");
  }

  async function createMeeting() {
    const res = await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        title: "Reunión de lectura",
      }),
    });
    if (res.ok) {
      loadMeetings();
    }
  }

  async function startMeeting() {
    if (!activeMeeting) return;
    await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", meetingId: activeMeeting.id }),
    });
  }

  async function endMeeting() {
    if (!activeMeeting) return;
    if (
      !confirm(
        "¿Finalizar esta reunión? Quienes estén en la sala ya no podrán seguir participando."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end", meetingId: activeMeeting.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJoinError(data.error || "No se pudo finalizar la reunión.");
      return;
    }
    leaveMeeting();
    await loadMeetings();
  }

  function leaveMeeting() {
    unsubscribeChatRef.current?.();
    unsubscribeChatRef.current = null;
    setActiveMeeting(null);
    setToken(null);
    setSelectedBook(null);
    setShowBooks(false);
    setChatMessages([]);
    setChatInput("");
    setIsHost(false);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (activeMeeting && token) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 lg:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {activeMeeting.title}
            </p>
            <p className="text-xs text-muted">Sala en vivo · lectura compartida</p>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBooks(!showBooks)}
              >
                <BookOpen className="h-4 w-4" />
                Ver libros
              </Button>
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

        {showBooks && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2">
            {books.length === 0 ? (
              <p className="py-1 text-sm text-muted">No hay libros en la biblioteca.</p>
            ) : (
              books.map((book) => (
                <Button
                  key={book.id}
                  variant={selectedBook?.id === book.id ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setSelectedBook(book);
                    setShowBooks(false);
                  }}
                >
                  {book.title}
                </Button>
              ))
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Lateral: cámara + chat */}
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border lg:w-[min(22rem,32%)] lg:border-b-0 lg:border-r xl:w-[28%]">
            <div className="relative z-10 flex aspect-video shrink-0 flex-col overflow-visible border-b border-border bg-surface lg:aspect-auto lg:h-[42%] lg:min-h-[12.5rem]">
              <LiveKitRoom
                token={token}
                serverUrl={livekitUrl}
                connect={true}
                video={isHost}
                audio={isHost}
                className="flex h-full min-h-0 flex-col overflow-visible"
                onDisconnected={leaveMeeting}
              >
                <MeetingVideoStage />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-background">
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
                <MessageSquare className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Chat en vivo</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-muted">Todavía no hay mensajes.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="mb-3 rounded-md bg-surface px-2.5 py-2">
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
                    className="bg-surface"
                  />
                  <Button type="submit" size="icon" aria-label="Enviar mensaje">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </aside>

          {/* Libro */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            {selectedBook ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <BookReader
                  title={selectedBook.title}
                  author={selectedBook.author}
                  pages={(selectedBook.content_json as BookPage[]) || []}
                  tableOfContents={(selectedBook.table_of_contents as BookTOCItem[]) || []}
                  pipelineVersion={selectedBook.pipeline_version ?? 0}
                  packMetrics={(selectedBook.pack_metrics as PackMetrics | null) ?? null}
                  compact
                  onDomPacked={async (packed, metrics) => {
                    setSelectedBook((prev) =>
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
                      await fetch(`/api/c/${slug}/books/${selectedBook.id}/paginate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          pages: packed,
                          packMetrics: metrics,
                          force: true,
                        }),
                      });
                    } catch (err) {
                      console.error("meeting paginate persist failed", err);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-surface/40 px-6">
                <div className="max-w-sm text-center">
                  <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted" />
                  <p className="text-base font-semibold text-foreground">
                    Elegí un libro para la reunión
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Tocá Ver libros arriba para abrir la biblioteca compartida.
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setShowBooks(true)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Ver libros
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sala de reuniones</h1>
          <p className="text-sm text-muted">Video en vivo con lectura y chat</p>
        </div>
        {isAdmin && <Button onClick={createMeeting}>Crear reunión</Button>}
      </div>

      {joinError && (
        <Card className="mb-4 border-red-200 hard-shadow-sm" role="alert">
          <CardContent className="py-4 text-sm text-red-700">
            {joinError}
          </CardContent>
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
                  onClick={() => joinMeeting(meeting)}
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
    </div>
  );
}
