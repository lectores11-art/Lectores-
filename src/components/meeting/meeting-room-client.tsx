"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { BookOpen, MessageSquare, Send, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BookReader } from "@/components/library/book-reader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Book, BookPage, BookTOCItem, Meeting, MeetingChatMessage } from "@/lib/types/database";

interface MeetingRoomClientProps {
  slug: string;
  isAdmin: boolean;
}

export function MeetingRoomClient({ slug, isAdmin }: MeetingRoomClientProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [demo, setDemo] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showBooks, setShowBooks] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMeetings();
    loadBooks();
  }, [slug]);

  async function loadMeetings() {
    const res = await fetch(`/api/c/${slug}/meetings`);
    const data = await res.json();
    setMeetings(data.meetings || []);
  }

  async function loadBooks() {
    const res = await fetch(`/api/c/${slug}/books`);
    const data = await res.json();
    setBooks(data.books || []);
  }

  async function joinMeeting(meeting: Meeting) {
    const res = await fetch(`/api/c/${slug}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "token", meetingId: meeting.id }),
    });
    const data = await res.json();
    setToken(data.token);
    setLivekitUrl(data.url || "");
    setIsHost(data.isHost);
    setDemo(data.demo || false);
    setActiveMeeting(meeting);
    subscribeToChat(meeting.id);
  }

  function subscribeToChat(meetingId: string) {
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

          setChatMessages((prev) => [
            ...prev,
            {
              ...(payload.new as MeetingChatMessage),
              profile: profile
                ? { id: profile.id, full_name: profile.full_name }
                : undefined,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !activeMeeting) return;

    const supabase = createClient();

    let userId: string | null = null;

    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
      // Use fixed demo user ID — profile was seeded server-side by ensureDemoProfile()
      userId = "00000000-0000-4000-8000-000000000001";
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId) return;

    await supabase.from("meeting_chat_messages").insert({
      meeting_id: activeMeeting.id,
      user_id: userId,
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (activeMeeting && token) {
    return (
      <div className="flex h-screen flex-col bg-slate-900">
        <div className="flex flex-1 overflow-hidden">
          {/* Video area */}
          <div className="flex w-1/3 flex-col border-r border-slate-700">
            {demo ? (
              <div className="flex flex-1 flex-col items-center justify-center p-4 text-white">
                <Video className="mb-4 h-12 w-12 text-sky-400" />
                <p className="text-center text-sm text-slate-400">
                  Modo demo: configura LIVEKIT_API_KEY y LIVEKIT_API_SECRET para video en vivo
                </p>
                {isHost && (
                  <div className="mt-4 h-48 w-full rounded-lg bg-slate-800 flex items-center justify-center">
                    <p className="text-slate-500">Cámara de la conductora</p>
                  </div>
                )}
              </div>
            ) : (
              <LiveKitRoom
                token={token}
                serverUrl={livekitUrl}
                connect={true}
                video={isHost}
                audio={isHost}
                className="flex-1"
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            )}
          </div>

          {/* Book reader area */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBooks(!showBooks)}
                className="border-slate-600 text-white"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Ver libros
              </Button>
              {isAdmin && (
                <Button size="sm" onClick={startMeeting}>
                  Iniciar transmisión
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveMeeting(null);
                  setToken(null);
                  setSelectedBook(null);
                }}
                className="text-white"
              >
                Salir
              </Button>
            </div>

            {showBooks && (
              <div className="flex gap-2 border-b border-slate-700 p-3">
                {books.map((book) => (
                  <Button
                    key={book.id}
                    variant={selectedBook?.id === book.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedBook(book);
                      setShowBooks(false);
                    }}
                  >
                    {book.title}
                  </Button>
                ))}
              </div>
            )}

            {selectedBook ? (
              <div className="flex-1 overflow-hidden">
                <BookReader
                  title={selectedBook.title}
                  author={selectedBook.author}
                  pages={(selectedBook.content_json as BookPage[]) || []}
                  tableOfContents={(selectedBook.table_of_contents as BookTOCItem[]) || []}
                  compact
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-400">
                <div className="text-center">
                  <BookOpen className="mx-auto mb-3 h-12 w-12" />
                  <p>Selecciona un libro para leer durante la reunión</p>
                </div>
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="flex w-72 flex-col border-l border-slate-700">
            <div className="border-b border-slate-700 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                <MessageSquare className="h-4 w-4" /> Chat en vivo
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="mb-3">
                  <p className="text-xs font-medium text-sky-400">
                    {msg.profile?.full_name || "Usuario"}
                  </p>
                  <p className="text-sm text-slate-300">{msg.content}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="border-t border-slate-700 p-3">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="bg-slate-800 text-white border-slate-600"
                />
                <Button type="submit" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sala de reuniones</h1>
          <p className="text-sm text-slate-500">Video en vivo con lectura y chat</p>
        </div>
        {isAdmin && <Button onClick={createMeeting}>Crear reunión</Button>}
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No hay reuniones programadas.
            {isAdmin && " Crea una para comenzar."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <CardTitle className="text-lg">{meeting.title}</CardTitle>
                <p className="text-sm text-slate-500">
                  Estado:{" "}
                  <span
                    className={
                      meeting.status === "live"
                        ? "text-green-600"
                        : meeting.status === "ended"
                          ? "text-slate-400"
                          : "text-sky-600"
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
                <Button onClick={() => joinMeeting(meeting)}>
                  <Video className="mr-2 h-4 w-4" />
                  Entrar a la sala
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
