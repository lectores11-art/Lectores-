"use client";

import { useEffect, useState, startTransition } from "react";
import Link from "next/link";
import { BookOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Book, ReadingProgress } from "@/lib/types/database";

interface LibraryPageClientProps {
  slug: string;
  isAdmin: boolean;
}

export function LibraryPageClient({ slug, isAdmin }: LibraryPageClientProps) {
  const [books, setBooks] = useState<(Book & { reading_progress?: ReadingProgress | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
      const body = await res.json().catch(() => ({}));
      setUploadError(body.error || "No se pudo subir el libro. Intentá de nuevo.");
      console.error("handleUpload error:", body);
    }
    setUploading(false);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Biblioteca</h1>
          <p className="text-sm text-slate-500">Libros de la comunidad</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir libro
          </Button>
        )}
      </div>

      {showUpload && isAdmin && (
        <Card className="mb-6">
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
                <p className="text-sm text-red-500">{uploadError}</p>
              )}
              <Button type="submit" disabled={uploading}>
                {uploading ? "Procesando..." : "Subir y procesar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-slate-500">Cargando biblioteca...</p>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No hay libros aún. {isAdmin && "Sube el primer PDF para comenzar."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const progress = Number(book.reading_progress?.progress_percent || 0);
            return (
              <Link key={book.id} href={`/c/${slug}/library/${book.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-sky-50">
                      <BookOpen className="h-10 w-10 text-sky-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900">{book.title}</h3>
                    {book.author && (
                      <p className="text-sm text-slate-500">{book.author}</p>
                    )}
                    <div className="mt-4">
                      <Progress value={progress} className="mb-1" />
                      <p className="text-xs text-slate-500">
                        {progress > 0 ? `${Math.round(progress)}% leído` : "Sin empezar"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
