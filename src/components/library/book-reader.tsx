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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
  fontSize: 16,
  fontFamily: "serif",
  theme: "light",
};

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
  const [showTOC, setShowTOC] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);

  const spreadIdx = Math.floor(currentPage / 2);
  const [leftPage, rightPage] = pagesForSpread(pages, spreadIdx);
  const totalPageCount = pages.length;
  const progressPercent = totalPageCount > 0 ? ((currentPage + 1) / totalPageCount) * 100 : 0;

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, totalPageCount - 1));
      setCurrentPage(clamped);
      const percent = totalPageCount > 0 ? ((clamped + 1) / totalPageCount) * 100 : 0;
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

  const themeClass = settings.theme === "sepia" ? "reader-sepia" : "reader-light";
  const fontClass = settings.fontFamily === "serif" ? "reader-serif" : "";

  return (
    <div className={cn("flex h-full flex-col", compact ? "bg-slate-900" : "bg-slate-900 min-h-screen")}>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-slate-700">
              <X className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-sm font-medium">{title}</h1>
            {author && <p className="text-xs text-slate-400">{author}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowTOC(!showTOC)} className="text-white hover:bg-slate-700">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className="text-white hover:bg-slate-700">
            <Type className="h-4 w-4" />
          </Button>
          {onBookmark && (
            <Button variant="ghost" size="icon" onClick={() => onBookmark(currentPage)} className="text-white hover:bg-slate-700">
              <Bookmark className="h-4 w-4" />
            </Button>
          )}
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={handleSearch} className="text-white hover:bg-slate-700">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {showTOC && (
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-800 p-4 scrollbar-thin">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Índice</h3>
            {tableOfContents.map((item, i) => (
              <button
                key={i}
                onClick={() => { goToPage(item.pageNumber); setShowTOC(false); }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700"
              >
                {item.title}
              </button>
            ))}
          </aside>
        )}

        {showSettings && (
          <aside className="w-56 shrink-0 border-r border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-slate-400">Tipografía</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Tamaño</label>
                <input
                  type="range"
                  min={12}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={settings.fontFamily === "serif" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, fontFamily: "serif" })}
                >
                  Serif
                </Button>
                <Button
                  size="sm"
                  variant={settings.fontFamily === "sans" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, fontFamily: "sans" })}
                >
                  Sans
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={settings.theme === "light" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, theme: "light" })}
                >
                  Claro
                </Button>
                <Button
                  size="sm"
                  variant={settings.theme === "sepia" ? "default" : "outline"}
                  onClick={() => setSettings({ ...settings, theme: "sepia" })}
                >
                  Sepia
                </Button>
              </div>
            </div>
          </aside>
        )}

        <div className="relative flex flex-1 flex-col items-center justify-center p-4">
          <div className="mb-3 flex w-full max-w-4xl gap-2">
            <Input
              placeholder="Buscar en el libro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="bg-slate-800 text-white border-slate-600"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {searchResults.slice(0, 5).map((p) => (
                <Button key={p} size="sm" variant="outline" onClick={() => goToPage(p)}>
                  Pág. {p + 1}
                </Button>
              ))}
            </div>
          )}

          <div className="relative w-full max-w-4xl rounded-lg shadow-2xl ring-2 ring-sky-400/30">
            <div className={cn("relative book-spread rounded-lg", themeClass)}>
              <div className="book-spine" />
              <div
                className={cn("book-page book-page-left", fontClass)}
                style={{ fontSize: settings.fontSize }}
              >
                {leftPage ? (
                  leftPage.content.split("\n\n").map((para, i) => (
                    <p key={i} className="mb-4 text-justify">{para}</p>
                  ))
                ) : (
                  <p className="text-slate-400 italic">—</p>
                )}
                <span className="absolute bottom-4 left-4 text-xs text-slate-400">
                  {leftPage ? leftPage.pageNumber + 1 : ""}
                </span>
              </div>
              <div
                className={cn("book-page", fontClass)}
                style={{ fontSize: settings.fontSize }}
              >
                {rightPage ? (
                  rightPage.content.split("\n\n").map((para, i) => (
                    <p key={i} className="mb-4 text-justify">{para}</p>
                  ))
                ) : (
                  <p className="text-slate-400 italic">—</p>
                )}
                <span className="absolute bottom-4 right-4 text-xs text-slate-400">
                  {rightPage ? rightPage.pageNumber + 1 : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage - 2)}
              disabled={currentPage <= 0}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-300">
              {currentPage + 1} de {totalPageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(currentPage + 2)}
              disabled={currentPage >= totalPageCount - 1}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-700 px-6 py-3">
        <Progress value={progressPercent} className="mb-1" />
        <p className="text-center text-xs text-slate-400">
          {Math.round(progressPercent)}% · Spread {spreadIdx + 1} de {totalSpreads(totalPageCount)}
        </p>
      </footer>
    </div>
  );
}
