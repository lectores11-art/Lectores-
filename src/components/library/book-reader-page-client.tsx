"use client";

import { useEffect, useState, useCallback } from "react";
import { BookReader } from "@/components/library/book-reader";
import type { Book, BookPage, BookTOCItem } from "@/lib/types/database";

export function BookReaderPageClient({
  slug,
  bookId,
}: {
  slug: string;
  bookId: string;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [initialPage, setInitialPage] = useState(0);
  const [loading, setLoading] = useState(true);

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
        setBook(bookData as Book);
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

  const pages = (book.content_json as BookPage[]) || [];
  const toc = (book.table_of_contents as BookTOCItem[]) || [];

  return (
    <BookReader
      key={`${book.id}-${initialPage}`}
      title={book.title}
      author={book.author}
      pages={pages}
      tableOfContents={toc}
      initialPage={initialPage}
      onPageChange={saveProgress}
      onBookmark={saveBookmark}
    />
  );
}
