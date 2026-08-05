"use client";

import { useEffect, useState, useCallback } from "react";
import { BookReader } from "@/components/library/book-reader";
import { Button } from "@/components/ui/button";
import type { Book, BookPage, BookTOCItem } from "@/lib/types/database";
import {
  PIPELINE_VERSION,
  type PackMetrics,
  type PaginatedPage,
} from "@/lib/pdf/paginator";

export function BookReaderPageClient({
  slug,
  bookId,
}: {
  slug: string;
  bookId: string;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<PaginatedPage[]>([]);
  const [pipelineVersion, setPipelineVersion] = useState(0);
  const [packMetrics, setPackMetrics] = useState<PackMetrics | null>(null);
  const [initialPage, setInitialPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/c/${slug}/books/${bookId}`);
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { book: bookData, initialPage: page } = await res.json();
      if (!cancelled) {
        const loaded = bookData as Book;
        setBook(loaded);
        setPages((loaded.content_json as BookPage[]) || []);
        setPipelineVersion(loaded.pipeline_version ?? 0);
        setPackMetrics((loaded.pack_metrics as PackMetrics | null) ?? null);
        setInitialPage(page ?? 0);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, bookId]);

  const saveProgress = useCallback(
    async (page: number, percent: number) => {
      await fetch(`/api/c/${slug}/books/${bookId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPage: page, progressPercent: percent }),
      });
    },
    [slug, bookId]
  );

  const saveBookmark = useCallback(
    async (page: number) => {
      await fetch(`/api/c/${slug}/books/${bookId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: page }),
      });
    },
    [slug, bookId]
  );

  const persistDomPack = useCallback(
    async (packed: PaginatedPage[], metrics: PackMetrics) => {
      setPages(packed);
      setPipelineVersion(PIPELINE_VERSION);
      setPackMetrics(metrics);
      setBook((prev) =>
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
        const res = await fetch(`/api/c/${slug}/books/${bookId}/paginate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: packed,
            packMetrics: metrics,
            force: true,
          }),
        });
        if (!res.ok) {
          console.error("paginate persist failed", await res.text());
          return;
        }
        const data = await res.json();
        if (data.book) {
          setBook((prev) =>
            prev
              ? {
                  ...prev,
                  ...data.book,
                  content_json: packed as BookPage[],
                  pack_metrics:
                    (data.book.pack_metrics as PackMetrics | null) ?? metrics,
                }
              : prev
          );
          setPipelineVersion(data.book.pipeline_version ?? PIPELINE_VERSION);
          setPackMetrics(
            (data.book.pack_metrics as PackMetrics | null) ?? metrics
          );
        }
      } catch (err) {
        console.error("paginate persist error", err);
      }
    },
    [slug, bookId]
  );

  async function openSignedPdf() {
    setPdfError("");
    const res = await fetch(`/api/c/${slug}/books/${bookId}/pdf`);
    const data = await res.json();
    if (!res.ok || !data.url) {
      setPdfError(data.error || "No se pudo obtener el PDF");
      return;
    }
    // Short-lived signed URL — open in a new tab; do not cache or re-share.
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        Cargando libro...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        Libro no encontrado
      </div>
    );
  }

  if (!book.pdf_storage_path) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-white">
        <p className="text-lg font-semibold">{book.title}</p>
        <p className="text-sm text-slate-300">
          Este libro está registrado como físico y no tiene PDF para leer en la
          plataforma.
        </p>
        <a
          href={`/c/${slug}/library`}
          className="text-sm font-bold uppercase tracking-wide text-amber-300 hover:underline"
        >
          Volver a la biblioteca
        </a>
      </div>
    );
  }

  const toc = (book.table_of_contents as BookTOCItem[]) || [];

  return (
    <div className="relative h-screen overflow-hidden">
      {book.pdf_storage_path && (
        <div className="absolute right-4 top-3 z-20 flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void openSignedPdf()}>
            PDF original
          </Button>
          {pdfError && <span className="text-xs text-red-400">{pdfError}</span>}
        </div>
      )}
      <BookReader
        key={book.id}
        title={book.title}
        author={book.author}
        pages={pages}
        tableOfContents={toc}
        initialPage={initialPage}
        onPageChange={saveProgress}
        onBookmark={saveBookmark}
        onDomPacked={persistDomPack}
        pipelineVersion={pipelineVersion}
        packMetrics={packMetrics}
      />
    </div>
  );
}
