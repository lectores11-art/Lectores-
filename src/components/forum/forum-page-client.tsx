"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Pin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/utils";
import type { ForumThread, Profile } from "@/lib/types/database";

interface ForumPageClientProps {
  slug: string;
  isAdmin: boolean;
}

export function ForumPageClient({ slug, isAdmin }: ForumPageClientProps) {
  const [threads, setThreads] = useState<(ForumThread & { author?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadThreads();
  }, [slug]);

  async function loadThreads() {
    const res = await fetch(`/api/c/${slug}/forum/threads`);
    const data = await res.json();
    setThreads(data.threads || []);
    setLoading(false);
  }

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const res = await fetch(`/api/c/${slug}/forum/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      setTitle("");
      setContent("");
      setShowForm(false);
      loadThreads();
    } else {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error || "No se pudo publicar el hilo. Intentá de nuevo.");
    }
    setSubmitting(false);
  }

  async function togglePin(threadId: string, current: boolean) {
    await fetch(`/api/c/${slug}/forum/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: !current }),
    });
    loadThreads();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Foro</h1>
          <p className="text-sm text-slate-500">Discusiones de la comunidad</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>Nuevo hilo</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={createThread} className="space-y-4">
              <Input
                placeholder="Título del hilo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Escribe tu mensaje..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
              />
              {submitError && (
                <p className="text-sm text-red-500">{submitError}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Publicando..." : "Publicar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-slate-500">Cargando hilos...</p>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Aún no hay hilos. ¡Sé la primera en publicar!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Card key={thread.id} className="transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {thread.is_pinned && (
                        <Pin className="h-3.5 w-3.5 text-sky-500" />
                      )}
                      {thread.is_featured && (
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <Link
                        href={`/c/${slug}/forum/${thread.id}`}
                        className="font-semibold text-slate-900 hover:text-sky-600"
                      >
                        {thread.title}
                      </Link>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">{thread.content}</p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePin(thread.id, thread.is_pinned)}
                    >
                      {thread.is_pinned ? "Desfijar" : "Fijar"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-xs text-slate-500">
                <span>{thread.author?.full_name || "Usuario"}</span>
                <span>{formatRelativeTime(thread.created_at)}</span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {thread.like_count}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {thread.reply_count}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
