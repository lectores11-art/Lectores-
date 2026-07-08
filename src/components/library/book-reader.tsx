"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  pagesForSpread,
  totalSpreads,
  type PaginatedPage,
  type TOCItem,
} from "@/lib/pdf/paginator";
import type { ReaderSettings } from "@/lib/types/database";
import { Input } from "@/components/ui/input";

interface BookReaderProps {
  title: string;
  author?: string | null;
  pages: PaginatedPage[];
  tableOfContents?: TOCItem[];
  initialPage?: number;
  onPageChange?: (page: number, percent: number) => void;
  onBookmark?: (page: number) => void;
  compact?: boolean;
  onClose?: () => void;
}

const defaultSettings: ReaderSettings = {
  fontSize: 17,
  fontFamily: "serif",
  theme: "light",
};

function isHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 48) return false;
  const known =
    /^(dedicatoria|pr[oó]logo|ep[ií]logo|introducci[oó]n|cap[ií]tulo|prefacio|[ií]ndice|nota|parte)\b/i.test(
      t
    );
  const isUpper = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t);
  return known || isUpper;
}

function PageContent({
  page,
  fontSize,
}: {
  page: PaginatedPage | null;
  fontSize: number;
}) {
  if (!page) return null;
  return (
    <>
      {page.content.split("\n\n").map((para, i) =>
        isHeading(para) ? (
          <h2 key={i} className="book-heading" style={{ fontSize: fontSize + 3 }}>
            {para}
          </h2>
        ) : (
          <p key={i} className="book-para" style={{ fontSize }}>
            {para}
          </p>
        )
      )}
    </>
  );
}

export function BookReader({
  title,
  author,
  pages,
  tableOfContents = [],
  initialPage = 0,
  onPageChange,
  onBookmark,
  compact = false,
  onClose,
}: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [panel, setPanel] = useState<"toc" | "settings" | "search" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [justBookmarked, setJustBookmarked] = useState(false);

  const spreadIdx = Math.floor(currentPage / 2);
  const [leftPage, rightPage] = pagesForSpread(pages, spreadIdx);
  const totalPageCount = pages.length;
  const progressPercent =
    totalPageCount > 0 ? ((currentPage + 1) / totalPageCount) * 100 : 0;

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, totalPageCount - 1));
      setCurrentPage(clamped);
      const percent =
        totalPageCount > 0 ? ((clamped + 1) / totalPageCount) * 100 : 0;
      onPageChange?.(clamped, percent);
    },
    [totalPageCount, onPageChange]
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToPage(currentPage + 2);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPage(currentPage - 2);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentPage, goToPage]);

  function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = pages
      .filter((p) => p.content.toLowerCase().includes(q))
      .map((p) => p.pageNumber);
    setSearchResults(results);
  }

  function togglePanel(next: "toc" | "settings" | "search") {
    setPanel((prev) => (prev === next ? null : next));
  }

  function handleBookmark() {
    onBookmark?.(currentPage);
    setJustBookmarked(true);
    setTimeout(() => setJustBookmarked(false), 1500);
  }

  const themeClass = settings.theme === "sepia" ? "reader-sepia" : "reader-light";
  const fontClass = settings.fontFamily === "serif" ? "reader-serif" : "";

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-800";

  return (
    <div
      className={cn(
        "reader-shell flex flex-col items-center justify-center",
        compact ? "h-full p-4" : "min-h-screen p-6"
      )}
    >
      <div
        className={cn(
          "book-frame w-full",
          compact ? "book-compact max-w-3xl" : "max-w-5xl"
        )}
      >
        <div className={cn("book-spread", themeClass, fontClass)}>
          <div className="book-spine" />

          {/* LEFT PAGE */}
          <div className="book-page book-page-left">
            {onClose && (
              <button
                onClick={onClose}
                className={cn(iconBtn, "absolute left-3 top-3")}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold tracking-wide text-slate-700">
                {title}
              </p>
              {author && (
                <p className="text-xs italic text-slate-500">{author}</p>
              )}
            </div>

            <PageContent page={leftPage} fontSize={settings.fontSize} />

            {leftPage && (
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                {leftPage.pageNumber + 1}
              </span>
            )}
            <div className="page-curl page-curl-left" />
          </div>

          {/* RIGHT PAGE */}
          <div className="book-page book-page-right">
            <div className="absolute right-3 top-3 flex items-center gap-1">
              <button onClick={() => togglePanel("toc")} className={iconBtn} aria-label="Índice">
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => togglePanel("settings")} className={iconBtn} aria-label="Tipografía">
                <Type className="h-4 w-4" />
              </button>
              {onBookmark && (
                <button
                  onClick={handleBookmark}
                  className={cn(iconBtn, justBookmarked && "text-sky-500")}
                  aria-label="Marcador"
                >
                  <Bookmark className="h-4 w-4" fill={justBookmarked ? "currentColor" : "none"} />
                </button>
              )}
              <button onClick={() => togglePanel("search")} className={iconBtn} aria-label="Buscar">
                <Search className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8">
              <PageContent page={rightPage} fontSize={settings.fontSize} />
            </div>

            {rightPage && (
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                {rightPage.pageNumber + 1}
              </span>
            )}
            <div className="page-curl page-curl-right" />
          </div>

          {/* Floating panels */}
          {panel === "toc" && (
            <div className="absolute right-3 top-12 z-10 max-h-[70%] w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl scrollbar-thin">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Índice
              </p>
              {tableOfContents.length === 0 ? (
                <p className="text-sm text-slate-400">Sin índice disponible</p>
              ) : (
                tableOfContents.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      goToPage(item.pageNumber);
                      setPanel(null);
                    }}
                    className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          )}

          {panel === "settings" && (
            <div className="absolute right-3 top-12 z-10 w-60 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tipografía
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500">
                    Tamaño de letra
                  </label>
                  <input
                    type="range"
                    min={13}
                    max={26}
                    value={settings.fontSize}
                    onChange={(e) =>
                      setSettings({ ...settings, fontSize: Number(e.target.value) })
                    }
                    className="w-full accent-sky-500"
                  />
                </div>
                <div className="flex gap-2">
                  {(["serif", "sans"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setSettings({ ...settings, fontFamily: f })}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-sm",
                        settings.fontFamily === f
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-600"
                      )}
                    >
                      {f === "serif" ? "Serif" : "Sans"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(["light", "sepia"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSettings({ ...settings, theme: t })}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-sm",
                        settings.theme === t
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-600"
                      )}
                    >
                      {t === "light" ? "Claro" : "Sepia"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {panel === "search" && (
            <div className="absolute right-3 top-12 z-10 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Buscar en el libro
              </p>
              <Input
                autoFocus
                placeholder="Escribe y presiona Enter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto scrollbar-thin">
                  <p className="mb-1 text-xs text-slate-400">
                    {searchResults.length} resultado(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.slice(0, 12).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          goToPage(p);
                          setPanel(null);
                        }}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Pág. {p + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-slate-400">Sin resultados</p>
              )}
            </div>
          )}
        </div>

        {/* Progress slider + page indicator inside the cover */}
        <div className="flex items-center gap-3 px-3 pt-3">
          <button
            onClick={() => goToPage(currentPage - 2)}
            disabled={currentPage <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40 disabled:opacity-30"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <input
            type="range"
            min={0}
            max={Math.max(0, totalPageCount - 1)}
            value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
          />

          <span className="min-w-[64px] text-center text-xs font-medium text-white/90">
            {currentPage + 1} de {totalPageCount}
          </span>

          <button
            onClick={() => goToPage(currentPage + 2)}
            disabled={currentPage >= totalPageCount - 1}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40 disabled:opacity-30"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!compact && (
        <p className="mt-3 text-xs text-slate-500">
          {Math.round(progressPercent)}% · Doble página {spreadIdx + 1} de{" "}
          {totalSpreads(totalPageCount)}
        </p>
      )}
    </div>
  );
}
