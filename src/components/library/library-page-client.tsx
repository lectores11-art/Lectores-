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
import { createClient } from "@/lib/supabase/client";
import {
  BOOKS_BUCKET,
  COVER_BUCKET,
  buildCommunityObjectPath,
  coverObjectContentType,
} from "@/lib/storage/book-upload-paths";
import { MAX_COVER_BYTES, MAX_PDF_BYTES } from "@/lib/validation/schemas";
import type { Book, ReadingProgress } from "@/lib/types/database";

interface LibraryPageClientProps {
  slug: string;
  communityId: string;
  isAdmin: boolean;
}

type BookRow = Book & { reading_progress?: ReadingProgress | null };
type UploadMode = "pdf" | "catalog";

function isDigitalBook(book: BookRow): boolean {
  return Boolean(book.pdf_storage_path);
}

function isCoverFile(file: File): boolean {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return true;
  }
  if (!file.type || file.type === "application/octet-stream") {
    const lower = file.name.toLowerCase();
    return (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  }
  return false;
}

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  if (!file.type || file.type === "application/octet-stream") {
    return file.name.toLowerCase().endsWith(".pdf");
  }
  return false;
}

export function LibraryPageClient({
  slug,
  communityId,
  isAdmin,
}: LibraryPageClientProps) {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("pdf");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
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
    const digital = isDigitalBook(book);
    setDetail({
      kind: "book",
      title: book.title,
      subtitle: book.author || undefined,
      description: book.description || undefined,
      imageUrl: book.cover_url,
      meta: [
        {
          label: "Progreso",
          value: digital
            ? progress > 0
              ? `${Math.round(progress)}%`
              : "Sin empezar"
            : "Libro físico",
        },
        { label: "Formato", value: digital ? "PDF" : "Físico" },
      ],
      primaryAction: digital
        ? {
            label: "Leer ahora",
            href: `/c/${slug}/library/${book.id}`,
          }
        : undefined,
      secondaryAction: digital
        ? {
            label: "Abrir ficha",
            href: `/c/${slug}/library/${book.id}`,
          }
        : undefined,
    });
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setUploadError("");
    setUploadStatus("Preparando…");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const author = String(formData.get("author") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const cover = formData.get("cover") as File | null;
    const file = formData.get("file") as File | null;

    let coverStoragePath: string | null = null;
    let pdfStoragePath: string | null = null;
    const supabase = createClient();

    try {
      if (!title) {
        setUploadError("El título es obligatorio.");
        return;
      }
      if (!cover || !isCoverFile(cover)) {
        setUploadError("Elegí una portada JPG, PNG o WebP.");
        return;
      }
      if (cover.size <= 0 || cover.size > MAX_COVER_BYTES) {
        setUploadError("La portada debe pesar como máximo 5 MB.");
        return;
      }
      if (uploadMode === "pdf") {
        if (!file || !isPdfFile(file)) {
          setUploadError("Elegí un archivo PDF.");
          return;
        }
        if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
          setUploadError("El PDF debe pesar como máximo 50 MB.");
          return;
        }
      }

      coverStoragePath = buildCommunityObjectPath(communityId, cover.name);
      setUploadStatus("Subiendo portada…");
      const { error: coverError } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(coverStoragePath, cover, {
          contentType: coverObjectContentType(cover),
          upsert: false,
        });
      if (coverError) {
        console.error("cover upload error:", coverError);
        setUploadError(
          "No se pudo subir la portada. ¿Aplicaste la migración de book-covers en Supabase?"
        );
        return;
      }

      if (uploadMode === "pdf" && file) {
        pdfStoragePath = buildCommunityObjectPath(communityId, file.name);
        setUploadStatus("Subiendo PDF…");
        const { error: pdfError } = await supabase.storage
          .from(BOOKS_BUCKET)
          .upload(pdfStoragePath, file, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (pdfError) {
          console.error("pdf upload error:", pdfError);
          await supabase.storage.from(COVER_BUCKET).remove([coverStoragePath]);
          setUploadError(
            "No se pudo subir el PDF. Revisá que seas admin de la comunidad e intentá de nuevo."
          );
          return;
        }
      }

      setUploadStatus(
        uploadMode === "pdf" ? "Procesando libro…" : "Registrando ficha…"
      );
      const res = await fetch(`/api/c/${slug}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author: author || null,
          description: description || null,
          mode: uploadMode,
          coverStoragePath,
          pdfStoragePath,
        }),
      });

      if (res.ok) {
        form.reset();
        setShowUpload(false);
        setUploadMode("pdf");
        setUploadStatus("");
        await refreshBooks();
        return;
      }

      const raw = await res.text();
      let body: { error?: string } = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as { error?: string };
        } catch {
          body = {};
        }
      }

      // If finalize failed after DB insert (e.g. huge response), don't wipe Storage.
      let saved = false;
      try {
        const check = await fetch(`/api/c/${slug}/books`);
        const checkData = (await check.json()) as { books?: BookRow[] };
        saved = (checkData.books || []).some(
          (b) =>
            b.title === title &&
            (uploadMode === "catalog"
              ? !b.pdf_storage_path
              : b.pdf_storage_path === pdfStoragePath)
        );
        if (saved) {
          setBooks(checkData.books || []);
        }
      } catch {
        /* ignore */
      }

      if (saved) {
        form.reset();
        setShowUpload(false);
        setUploadMode("pdf");
        setUploadStatus("");
        return;
      }

      const toRemoveCover = coverStoragePath;
      const toRemovePdf = pdfStoragePath;
      coverStoragePath = null;
      pdfStoragePath = null;
      if (toRemoveCover) {
        await supabase.storage.from(COVER_BUCKET).remove([toRemoveCover]);
      }
      if (toRemovePdf) {
        await supabase.storage.from(BOOKS_BUCKET).remove([toRemovePdf]);
      }

      const detail =
        typeof (body as { detail?: unknown }).detail === "string"
          ? String((body as { detail: string }).detail)
          : "";
      const message =
        body.error ||
        (res.status >= 500
          ? uploadMode === "pdf"
            ? "Error del servidor al procesar el PDF. Probá de nuevo."
            : "Error del servidor al registrar el libro."
          : `No se pudo subir el libro (${res.status}).`);
      setUploadError(detail ? `${message} (${detail})` : message);
      console.error("handleUpload error:", {
        status: res.status,
        body,
        raw: raw.slice(0, 500),
      });
    } catch (err) {
      console.error("handleUpload exception:", err);
      if (coverStoragePath) {
        await supabase.storage.from(COVER_BUCKET).remove([coverStoragePath]);
      }
      if (pdfStoragePath) {
        await supabase.storage.from(BOOKS_BUCKET).remove([pdfStoragePath]);
      }
      setUploadError("Error de red al subir. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const progress = Number(book.reading_progress?.progress_percent || 0);
      const digital = isDigitalBook(book);
      if (filter === "reading" && !(digital && progress > 0 && progress < 100)) {
        return false;
      }
      if (filter === "new" && (!digital || progress > 0)) return false;
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
          <Button
            onClick={() => {
              setShowUpload(!showUpload);
              setUploadError("");
            }}
          >
            <Upload className="h-4 w-4" />
            Añadir libro
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
            <CardTitle className="text-lg">
              {uploadMode === "pdf" ? "Subir PDF" : "Registrar libro"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              <FilterPill
                active={uploadMode === "pdf"}
                onClick={() => {
                  setUploadMode("pdf");
                  setUploadError("");
                }}
              >
                Subir PDF
              </FilterPill>
              <FilterPill
                active={uploadMode === "catalog"}
                onClick={() => {
                  setUploadMode("catalog");
                  setUploadError("");
                }}
              >
                Registrar libro
              </FilterPill>
            </div>
            <p className="mb-4 text-sm text-muted">
              {uploadMode === "pdf"
                ? "Libro digital para leer en la plataforma. La portada es obligatoria. El PDF se sube directo a almacenamiento (hasta 50 MB)."
                : "Ficha de libro físico (sin PDF). Solo se muestra en el catálogo."}
            </p>
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
                <Label htmlFor="cover">Portada</Label>
                <Input
                  id="cover"
                  name="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  required
                />
              </div>
              {uploadMode === "pdf" && (
                <div className="space-y-2">
                  <Label htmlFor="file">Archivo PDF</Label>
                  <Input id="file" name="file" type="file" accept=".pdf" required />
                </div>
              )}
              {uploadStatus && (
                <p className="text-sm text-muted">{uploadStatus}</p>
              )}
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
              <Button type="submit" disabled={uploading}>
                {uploading
                  ? uploadStatus || "Subiendo…"
                  : uploadMode === "pdf"
                    ? "Subir y procesar"
                    : "Registrar libro"}
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
              ? `No hay libros aún. ${isAdmin ? "Añadí el primer libro para comenzar." : ""}`
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
              const digital = isDigitalBook(book);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => selectBook(book)}
                  className="group text-left"
                >
                  <Card className="h-full transition-transform hard-shadow-sm">
                    <CardContent className="p-4">
                      <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-md border border-border bg-accent-light">
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
                        {digital ? (
                          <>
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
                          </>
                        ) : (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Libro físico
                          </p>
                        )}
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
