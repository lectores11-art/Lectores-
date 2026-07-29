"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { BookOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FilterPill } from "@/components/ui/filter-pill";
import { useDetailPanel } from "@/components/layout/detail-panel-context";
import type { Book, ReadingProgress } from "@/lib/types/database";

interface LibraryPageClientProps {
  slug: string;
  isAdmin: boolean;
}

type BookRow = Book & { reading_progress?: ReadingProgress | null };

export function LibraryPageClient({ slug, isAdmin }: LibraryPageClientProps) {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [filter, setFilter] = useState<"all" | "reading" | "new">("all");
  const {
    setDetail,
    searchQuery,
    setSearchPlaceholder,
  } = useDetailPanel();

  useEffect(() => {
    setSearchPlaceholder("Título, autor o tema…");
  }, [setSearchPlaceholder]);

  async function refreshBooks() {
    const res = await fetch(`/api/c/${slug}/books`);
    const data = await res.json();
    setBooks(data.books || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/c/${slug}/books`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          startTransition(() => {
            setBooks(data.books || []);
            setLoading(false);
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function selectBook(book: BookRow) {
    const progress = Number(book.reading_progress?.progress_percent || 0);
    setDetail({
      kind: "book",
      title: book.title,
      subtitle: book.author || undefined,
      description: book.description || undefined,
      imageUrl: book.cover_url,
      meta: [
        {
          label: "Progreso",
          value: progress > 0 ? `${Math.round(progress)}%` : "Sin empezar",
        },
        { label: "Formato", value: "PDF" },
      ],
      primaryAction: {
        label: "Leer ahora",
        href: `/c/${slug}/library/${book.id}`,
      },
      secondaryAction: {
        label: "Abrir ficha",
        href: `/c/${slug}/library/${book.id}`,
      },
    });
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setUploadError("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await fetch(`/api/c/${slug}/books`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      form.reset();
      setShowUpload(false);
      await refreshBooks();
    } else {
      const raw = await res.text();
      let body: { error?: string } = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as { error?: string };
        } catch {
          body = {};
        }
      }
      const message =
        body.error ||
        (res.status >= 500
          ? "Error del servidor al procesar el PDF. Si el archivo es muy grande, probá de nuevo o revisá la terminal del servidor."
          : `No se pudo subir el libro (${res.status}).`);
      setUploadError(message);
      console.error("handleUpload error:", { status: res.status, body, raw: raw.slice(0, 300) });
    }
    setUploading(false);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const progress = Number(book.reading_progress?.progress_percent || 0);
      if (filter === "reading" && !(progress > 0 && progress < 100)) return false;
      if (filter === "new" && progress > 0) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        (book.author || "").toLowerCase().includes(q) ||
        (book.description || "").toLowerCase().includes(q)
      );
    });
  }, [books, filter, searchQuery]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted">Libros de la comunidad</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4" />
            Subir libro
          </Button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          Todo
        </FilterPill>
        <FilterPill
          active={filter === "reading"}
          onClick={() => setFilter("reading")}
        >
          En lectura
        </FilterPill>
        <FilterPill active={filter === "new"} onClick={() => setFilter("new")}>
          Sin empezar
        </FilterPill>
      </div>

      {showUpload && isAdmin && (
        <Card className="mb-6 hard-shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Subir PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Autor</Label>
                <Input id="author" name="author" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input id="description" name="description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Archivo PDF</Label>
                <Input id="file" name="file" type="file" accept=".pdf" required />
              </div>
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
              <Button type="submit" disabled={uploading}>
                {uploading ? "Procesando..." : "Subir y procesar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted">Cargando biblioteca...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            {books.length === 0
              ? `No hay libros aún. ${isAdmin ? "Subí el primer PDF para comenzar." : ""}`
              : "Ningún libro coincide con la búsqueda."}
          </CardContent>
        </Card>
      ) : (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold">Catálogo</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {filtered.length} libros
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((book) => {
              const progress = Number(book.reading_progress?.progress_percent || 0);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => selectBook(book)}
                  className="group text-left"
                >
                  <Card className="h-full transition-transform hard-shadow-hover hard-shadow-sm">
                    <CardContent className="p-4">
                      <div className="mb-3 flex h-36 items-center justify-center overflow-hidden border-2 border-foreground bg-band">
                        {book.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.cover_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BookOpen className="h-10 w-10 text-foreground" />
                        )}
                      </div>
                      <h3 className="font-bold leading-snug">{book.title}</h3>
                      {book.author && (
                        <p className="mt-1 text-sm text-muted">{book.author}</p>
                      )}
                      <div className="mt-3">
                        <Progress value={progress} className="mb-1" />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted">
                            {progress > 0
                              ? `${Math.round(progress)}% leído`
                              : "Sin empezar"}
                          </p>
                          <Link
                            href={`/c/${slug}/library/${book.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold uppercase tracking-wide text-accent hover:underline"
                          >
                            Leer
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
