"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractTOC,
  flattenPageBlocks,
  hasLegacyPaginationBug,
  mergeContinuationParagraphs,
  needsDomPack,
  packMetricsStale,
  pagesForSpread,
  getPageBlocks,
  totalSpreads,
  clampToSpreadStart,
  type PackMetrics,
  type PaginatedPage,
  type TOCItem,
} from "@/lib/pdf/paginator";
import type { ReaderSettings } from "@/lib/types/database";
import { Input } from "@/components/ui/input";
import { PageContent } from "@/components/library/book-reader-blocks";

interface BookReaderProps {
  title: string;
  author?: string | null;
  pages: PaginatedPage[];
  tableOfContents?: TOCItem[];
  initialPage?: number;
  onPageChange?: (page: number, percent: number) => void;
  onBookmark?: (page: number) => void;
  /** Called after DOM measure-and-pack (pipeline upgrade or viewport re-pack). */
  onDomPacked?: (
    pages: PaginatedPage[],
    metrics: PackMetrics
  ) => void | Promise<void>;
  compact?: boolean;
  onClose?: () => void;
  pipelineVersion?: number;
  /** Viewport used for the pages currently in `pages` (from DB). */
  packMetrics?: PackMetrics | null;
  legacyWarning?: boolean;
}

const defaultSettings: ReaderSettings = {
  fontSize: 16,
  fontFamily: "serif",
  theme: "light",
};

/** Normalize continued fragments within each stored page (display only — no reflow). */
function normalizePages(pages: PaginatedPage[]): PaginatedPage[] {
  return pages.map((page) => {
    const blocks = mergeContinuationParagraphs(getPageBlocks(page));
    return {
      ...page,
      blocks,
      content: blocks.map((b) => b.text).join("\n\n"),
    };
  });
}

export function BookReader({
  title,
  author,
  pages,
  tableOfContents = [],
  initialPage = 0,
  onPageChange,
  onBookmark,
  onDomPacked,
  compact = false,
  onClose,
  pipelineVersion = 0,
  packMetrics = null,
  legacyWarning = false,
}: BookReaderProps) {
  const [livePages, setLivePages] = useState(pages);
  const [preparing, setPreparing] = useState(
    () => needsDomPack(pipelineVersion) || !packMetrics
  );
  const packingRef = useRef(false);
  const onDomPackedRef = useRef(onDomPacked);
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(() =>
    clampToSpreadStart(initialPage, pages.length)
  );
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [panel, setPanel] = useState<"toc" | "settings" | "search" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [justBookmarked, setJustBookmarked] = useState(false);

  useEffect(() => {
    onDomPackedRef.current = onDomPacked;
  }, [onDomPacked]);

  useEffect(() => {
    setLivePages(pages);
  }, [pages]);

  // Pack when pipeline is outdated OR the saved viewport no longer matches this screen.
  useEffect(() => {
    if (pages.length === 0) {
      setPreparing(false);
      return;
    }

    let cancelled = false;

    async function runPack() {
      if (packingRef.current) return;

      // Wait for book frame layout so column width/height are real.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        const {
          measureAndPackBlocks,
          PACK_FONT_SIZE,
          pageBodyMetrics,
        } = await import("@/lib/pdf/measure-and-pack");

        const leftEl = leftBodyRef.current;
        const rightEl = rightBodyRef.current;
        if (!leftEl) {
          setPreparing(false);
          return;
        }

        const left = pageBodyMetrics(leftEl);
        const right = rightEl ? pageBodyMetrics(rightEl) : left;
        const currentMetrics: PackMetrics = {
          widthPx: left.widthPx,
          leftHeightPx: left.heightPx,
          rightHeightPx: right.heightPx,
          fontSize: PACK_FONT_SIZE,
        };

        if (currentMetrics.widthPx < 80 || currentMetrics.leftHeightPx < 80) {
          setPreparing(false);
          return;
        }

        const mustPack =
          needsDomPack(pipelineVersion) ||
          packMetricsStale(packMetrics, currentMetrics);

        if (!mustPack) {
          setPreparing(false);
          return;
        }

        packingRef.current = true;
        setPreparing(true);

        const blocks = flattenPageBlocks(pages);
        const packed = measureAndPackBlocks(blocks, {
          columnWidthPx: currentMetrics.widthPx,
          leftHeightPx: currentMetrics.leftHeightPx,
          rightHeightPx: currentMetrics.rightHeightPx,
          fontSize: PACK_FONT_SIZE,
        });
        if (cancelled) {
          packingRef.current = false;
          return;
        }
        setSettings((s) => ({ ...s, fontSize: PACK_FONT_SIZE }));
        setLivePages(packed);
        setPreparing(false);
        await onDomPackedRef.current?.(packed, currentMetrics);
        packingRef.current = false;
      } catch (err) {
        console.error("DOM pack failed; showing estimated pages:", err);
        packingRef.current = false;
        if (!cancelled) setPreparing(false);
      }
    }

    void runPack();
    return () => {
      cancelled = true;
    };
  }, [pipelineVersion, pages, packMetrics]);

  // Stable stored / packed pages — never continuous reflow.
  const displayPages = useMemo(() => normalizePages(livePages), [livePages]);

  const displayToc = useMemo(() => {
    const rebuilt = extractTOC(displayPages);
    return rebuilt.length > 0 ? rebuilt : tableOfContents;
  }, [displayPages, tableOfContents]);

  const totalPageCount = displayPages.length;
  // Clamp in render (not an effect) so shrinking page lists cannot leave an OOB index.
  const safePage = clampToSpreadStart(currentPage, totalPageCount);
  const spreadIdx = Math.floor(safePage / 2);
  const [leftPage, rightPage] = pagesForSpread(displayPages, spreadIdx);
  const progressPercent =
    totalPageCount > 0 ? ((safePage + 1) / totalPageCount) * 100 : 0;

  const goToPage = useCallback(
    (page: number) => {
      const clamped = clampToSpreadStart(page, totalPageCount);
      setCurrentPage(clamped);
      const percent =
        totalPageCount > 0 ? ((clamped + 1) / totalPageCount) * 100 : 0;
      onPageChange?.(clamped, percent);
    },
    [totalPageCount, onPageChange]
  );

  const goNextSpread = useCallback(() => {
    goToPage(spreadIdx * 2 + 2);
  }, [goToPage, spreadIdx]);

  const goPrevSpread = useCallback(() => {
    goToPage(spreadIdx * 2 - 2);
  }, [goToPage, spreadIdx]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (preparing) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNextSpread();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevSpread();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNextSpread, goPrevSpread, preparing]);

  function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = displayPages
      .filter((p) => p.content.toLowerCase().includes(q))
      .map((p) => p.pageNumber);
    setSearchResults(results);
  }

  function togglePanel(next: "toc" | "settings" | "search") {
    setPanel((prev) => (prev === next ? null : next));
  }

  function handleBookmark() {
    onBookmark?.(safePage);
    setJustBookmarked(true);
    setTimeout(() => setJustBookmarked(false), 1500);
  }

  const themeClass = settings.theme === "sepia" ? "reader-sepia" : "reader-light";
  const fontClass = settings.fontFamily === "serif" ? "reader-serif" : "";

  const iconBtn =
    "flex h-8 w-8 items-center justify-center text-[#5a5a5a] transition-colors hover:text-[#1a1a1a]";

  // Only warn for known-broken content — not every pipeline bump or long books.
  const showLegacyBanner =
    legacyWarning ||
    hasLegacyPaginationBug(pages) ||
    (pipelineVersion > 0 && pipelineVersion < 4);

  const displayPageNumber = leftPage
    ? leftPage.pageNumber + 1
    : Math.min(safePage + 1, Math.max(totalPageCount, 1));

  return (
    <div
      className={cn(
        "reader-shell flex flex-col items-center justify-center",
        compact ? "h-full overflow-hidden p-4" : "p-6"
      )}
    >
      {showLegacyBanner && !compact && (
        <p className="mb-3 max-w-5xl rounded-md border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
          Este libro fue procesado con una versión antigua. Borralo y volvé a subir el PDF
          para ver el texto correctamente.
        </p>
      )}

      <div
        className={cn(
          "book-reader-stage w-full",
          compact ? "book-compact max-w-3xl" : "max-w-5xl"
        )}
      >
        <header className="book-external-title">
          <p className="book-external-title-name">{title}</p>
          {author ? <p className="book-external-title-author">{author}</p> : null}
        </header>

        <div className="book-frame relative w-full">
        {preparing && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-slate-900/80 px-6 text-center text-white"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold tracking-wide">
              Preparando páginas…
            </p>
            <p className="max-w-sm text-xs text-slate-300">
              Ajustando el texto a la tipografía del libro. Solo hace falta una vez.
            </p>
          </div>
        )}

        <div className={cn("book-block", themeClass, fontClass)}>
          <div className="book-edge book-edge-left" aria-hidden />

          <div className="book-spread">
            <div className="book-spine" />

            <div className="book-chrome-header">
              {onClose ? (
                <button
                  onClick={onClose}
                  className={cn(iconBtn, "justify-self-start")}
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center justify-end gap-0.5 justify-self-end">
                <button onClick={() => togglePanel("toc")} className={iconBtn} aria-label="Índice">
                  <List className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => togglePanel("settings")}
                  className={cn(iconBtn, "text-[11px] font-semibold tracking-tight")}
                  aria-label="Tipografía"
                >
                  AA
                </button>
                <button className={iconBtn} aria-label="Favorito" type="button">
                  <Star className="h-4 w-4" strokeWidth={1.75} />
                </button>
                {onBookmark && (
                  <button
                    onClick={handleBookmark}
                    className={cn(iconBtn, justBookmarked && "text-sky-600")}
                    aria-label="Marcador"
                  >
                    <Bookmark
                      className="h-4 w-4"
                      strokeWidth={1.75}
                      fill={justBookmarked ? "currentColor" : "none"}
                    />
                  </button>
                )}
                <button onClick={() => togglePanel("search")} className={iconBtn} aria-label="Buscar">
                  <Search className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* LEFT PAGE */}
            <div className="book-page book-page-left">
              <div className="book-page-body" ref={leftBodyRef}>
                <PageContent page={leftPage} fontSize={settings.fontSize} />
              </div>
              <div className="page-curl page-curl-left" />
            </div>

            {/* RIGHT PAGE */}
            <div className="book-page book-page-right">
              <div className="book-page-body" ref={rightBodyRef}>
                <PageContent page={rightPage} fontSize={settings.fontSize} />
              </div>
              <div className="page-curl page-curl-right" />
            </div>

            <div className="book-progress">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSpreads(totalPageCount) - 1)}
                value={spreadIdx}
                disabled={preparing}
                onChange={(e) => goToPage(Number(e.target.value) * 2)}
                className="book-progress-track disabled:opacity-40"
                aria-label="Progreso de lectura"
              />
              <span className="book-progress-label">
                {displayPageNumber} de {totalPageCount || 0}
              </span>
            </div>

            {panel === "toc" && (
              <div className="absolute right-3 top-12 z-20 max-h-[70%] w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl scrollbar-thin">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Índice
                </p>
                {displayToc.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin índice disponible</p>
                ) : (
                  displayToc.map((item, i) => (
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
              <div className="absolute right-3 top-12 z-20 w-60 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
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
                      min={16}
                      max={16}
                      value={16}
                      disabled
                      title="El tamaño está fijado al de la paginación (16px) para evitar cortes"
                      className="w-full accent-sky-500 opacity-50"
                    />
                    <p className="mt-1 text-[10px] leading-snug text-slate-400">
                      Fijado en 16px (mismo tamaño con el que se arman las páginas).
                    </p>
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
              <div className="absolute right-3 top-12 z-20 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
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

          <div className="book-edge book-edge-right" aria-hidden />
        </div>

        <button
          onClick={goPrevSpread}
          disabled={preparing || spreadIdx <= 0}
          className="book-nav-btn book-nav-prev"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={goNextSpread}
          disabled={preparing || spreadIdx >= totalSpreads(totalPageCount) - 1}
          className="book-nav-btn book-nav-next"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        </div>
      </div>

      {!compact && (
        <p className="sr-only">
          {Math.round(progressPercent)}% · Doble página {spreadIdx + 1} de{" "}
          {totalSpreads(totalPageCount)}
        </p>
      )}
    </div>
  );
}
