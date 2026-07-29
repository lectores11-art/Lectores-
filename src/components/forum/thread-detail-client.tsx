"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import { formatRelativeTime } from "@/lib/utils";
import type { ForumPost, ForumThread, Profile } from "@/lib/types/database";

export function ThreadDetailClient({ slug, threadId }: { slug: string; threadId: string }) {
  const [thread, setThread] = useState<(ForumThread & { author?: Profile }) | null>(null);
  const [posts, setPosts] = useState<(ForumPost & { author?: Profile })[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const { setSearchPlaceholder } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Buscar en el hilo…");
  }, [setSearchPlaceholder]);

  useEffect(() => {
    loadThread();
  }, [slug, threadId]);

  async function loadThread() {
    const res = await fetch(`/api/c/${slug}/forum/threads/${threadId}`);
    const data = await res.json();
    setThread(data.thread);
    setPosts(data.posts || []);
    setLoading(false);
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/c/${slug}/forum/threads/${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setContent("");
      loadThread();
    }
  }

  async function toggleLike() {
    await fetch(`/api/c/${slug}/forum/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    });
    loadThread();
  }

  if (loading) return <div className="p-6 text-muted">Cargando...</div>;
  if (!thread) return <div className="p-6 text-red-600">Hilo no encontrado</div>;

  return (
    <div className="p-4 lg:p-6">
      <Link
        href={`/c/${slug}/forum`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al foro
      </Link>

      <Card className="mb-6 hard-shadow-sm">
        <CardContent className="pt-6">
          <h1 className="text-xl font-bold">{thread.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {thread.author?.full_name} · {formatRelativeTime(thread.created_at)}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-foreground/90">{thread.content}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={toggleLike}>
            <Heart className="h-4 w-4" /> {thread.like_count}
          </Button>
        </CardContent>
      </Card>

      <div className="mb-6 space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className="hard-shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted">
                {post.author?.full_name} · {formatRelativeTime(post.created_at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-foreground/90">{post.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hard-shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={submitReply} className="space-y-3">
            <Textarea
              placeholder="Escribe tu respuesta..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={3}
            />
            <Button type="submit">Responder</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
