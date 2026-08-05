"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Pin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { formatRelativeTime } from "@/lib/utils";
import type { ForumThread, Profile } from "@/lib/types/database";

interface ForumPageClientProps {
  slug: string;
  isAdmin: boolean;
}

export function ForumPageClient({ slug, isAdmin }: ForumPageClientProps) {
  const [threads, setThreads] = useState<(ForumThread & { author?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { searchQuery, setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar hilos o autores…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    loadThreads();
  }, [slug]);

  async function loadThreads() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/c/${slug}/forum/threads`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setThreads([]);
        setLoadError(
          data.error ||
            "No se pudieron cargar los hilos. Intentá de nuevo en un momento."
        );
        return;
      }
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
      setLoadError(
        "No se pudieron cargar los hilos. Revisá tu conexión e intentá de nuevo."
      );
    } finally {
      setLoading(false);
    }
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

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        (t.author?.full_name || "").toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Foro</h1>
          <p className="text-sm text-muted">Discusiones de la comunidad</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>Nuevo hilo</Button>
      </div>

      {showForm && (
        <Card className="mb-6 hard-shadow-sm">
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
                <p className="text-sm text-red-600">{submitError}</p>
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
        <Card className="hard-shadow-sm">
          <CardContent className="py-12 text-center text-muted">
            Cargando hilos…
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="hard-shadow-sm">
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => loadThreads()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="hard-shadow-sm">
          <CardContent className="py-12 text-center text-muted">
            {threads.length === 0
              ? "Aún no hay hilos. ¡Sé la primera en publicar!"
              : "Ningún hilo coincide con la búsqueda."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((thread) => (
            <Card key={thread.id} className="hard-shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {thread.is_pinned && (
                        <Pin className="h-3.5 w-3.5 text-accent" />
                      )}
                      {thread.is_featured && (
                        <Star className="h-3.5 w-3.5 text-band" />
                      )}
                      <Link
                        href={`/c/${slug}/forum/${thread.id}`}
                        className="font-bold hover:text-accent"
                      >
                        {thread.title}
                      </Link>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted">{thread.content}</p>
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
              <CardContent className="flex items-center gap-4 text-xs text-muted">
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
