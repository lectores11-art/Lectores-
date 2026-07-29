export type TextBlockStyle = "title" | "subtitle" | "list-item" | "heading" | "paragraph";

export interface TextBlock {
  style: TextBlockStyle;
  text: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
}

export interface PaginatedPage {
  pageNumber: number;
  /** Plain-text fallback for search and legacy books. */
  content: string;
  blocks?: TextBlock[];
}

export interface TOCItem {
  title: string;
  pageNumber: number;
}

/** Words per reader half-page — even = left (title chrome), odd = right (toolbar). */
export const LEFT_PAGE_WORDS = 80;
export const RIGHT_PAGE_WORDS = 105;

/** @deprecated Use LEFT_PAGE_WORDS / RIGHT_PAGE_WORDS per page index. */
export const READER_WORDS_PER_PAGE = LEFT_PAGE_WORDS;

/** Bump when extraction/pagination logic changes; stored on each book row. */
export const PIPELINE_VERSION = 3;

/** Safety cap for content_json size in DB. */
export const MAX_STORED_PAGES = 1500;

const TITLE_PATTERN =
  /^(tabla de contenido|índice|indice|introducción|introduccion|dedicatoria|prólogo|prologo|epílogo|epilogo|prefacio|nota|parte)$/i;

const LIST_ITEM_PATTERN = /^(libro|capítulo|capitulo|chapter)\s+\d+\s*:/i;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Classify a single extracted line for reader presentation (Level A heuristics). */
export function classifyLineStyle(line: string): TextBlockStyle {
  const t = line.trim();
  if (!t) return "paragraph";

  if (TITLE_PATTERN.test(t)) return "title";
  if (LIST_ITEM_PATTERN.test(t)) return "list-item";

  const isAllCaps = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t) && t.length <= 60;
  if (isAllCaps && !LIST_ITEM_PATTERN.test(t)) return "subtitle";

  if (t.length <= 48) {
    const knownHeading =
      /^(dedicatoria|pr[oó]logo|ep[ií]logo|introducci[oó]n|cap[ií]tulo|prefacio|[ií]ndice|nota|parte)\b/i.test(
        t
      );
    if (knownHeading) return "heading";
  }

  return "paragraph";
}

function shouldJoinProseLines(prev: string, next: string): boolean {
  if (prev.endsWith("-")) return true;
  if (/[.!?:;]$/.test(prev)) return false;
  if (next.length > 0 && next[0] === next[0].toLowerCase() && /[a-záéíóúñ]/.test(next[0])) {
    return true;
  }
  return false;
}

/** Build structured blocks — preserves TOC/list lines; merges wrapped prose only. */
export function buildBlocks(fullText: string): TextBlock[] {
  const normalized = fullText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const raw of rawLines) {
    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (!collapsed) {
      lines.push("");
      continue;
    }
    lines.push(collapsed);
  }

  const blocks: TextBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i] === "") {
      i++;
      continue;
    }

    const line = lines[i];
    const style = classifyLineStyle(line);

    if (style !== "paragraph") {
      blocks.push({ style, text: line });
      i++;
      continue;
    }

    let paragraph = line;
    i++;
    while (i < lines.length && lines[i] !== "") {
      const next = lines[i];
      const nextStyle = classifyLineStyle(next);
      if (nextStyle !== "paragraph") break;
      if (!shouldJoinProseLines(paragraph, next)) break;
      if (paragraph.endsWith("-")) {
        paragraph = paragraph.slice(0, -1) + next;
      } else {
        paragraph += " " + next;
      }
      i++;
    }

    blocks.push({ style: "paragraph", text: paragraph.trim() });
  }

  return blocks;
}

function serializeBlocks(blocks: TextBlock[]): string {
  return blocks.map((b) => b.text).join("\n");
}

function wordsLimitForPage(pageIndex: number): number {
  return pageIndex % 2 === 0 ? LEFT_PAGE_WORDS : RIGHT_PAGE_WORDS;
}

/**
 * Split normalized book text into reader pages with structured blocks.
 */
export function paginateText(fullText: string): PaginatedPage[] {
  const cleaned = fullText.trim();

  if (!cleaned) {
    const fallback = "Este libro no tiene contenido extraíble.";
    return [
      {
        pageNumber: 0,
        content: fallback,
        blocks: [{ style: "paragraph", text: fallback }],
      },
    ];
  }

  const sourceBlocks = buildBlocks(cleaned);
  const pages: PaginatedPage[] = [];
  let pageBlocks: TextBlock[] = [];
  let pageWordCount = 0;

  function flushPage() {
    if (pageBlocks.length === 0) return;
    pages.push({
      pageNumber: pages.length,
      content: serializeBlocks(pageBlocks),
      blocks: pageBlocks,
    });
    pageBlocks = [];
    pageWordCount = 0;
  }

  for (const block of sourceBlocks) {
    if (block.style !== "paragraph") {
      const wc = countWords(block.text);
      const limit = wordsLimitForPage(pages.length);
      if (wc > limit - pageWordCount && pageBlocks.length > 0) {
        flushPage();
      }
      pageBlocks.push(block);
      pageWordCount += wc;
      if (pageWordCount >= wordsLimitForPage(pages.length)) {
        flushPage();
      }
      continue;
    }

    const words = block.text.trim().split(/\s+/).filter(Boolean);
    let index = 0;

    while (index < words.length) {
      const limit = wordsLimitForPage(pages.length);
      const spaceLeft = limit - pageWordCount;
      if (spaceLeft <= 0) {
        flushPage();
        continue;
      }

      const take = Math.min(spaceLeft, words.length - index);
      const chunk = words.slice(index, index + take).join(" ");
      index += take;

      pageBlocks.push({ style: "paragraph", text: chunk });
      pageWordCount += take;

      if (pageWordCount >= limit) {
        flushPage();
      }
    }
  }

  flushPage();

  return pages.length > 0
    ? pages
    : [{ pageNumber: 0, content: cleaned, blocks: [{ style: "paragraph", text: cleaned }] }];
}

/** Reconstruct blocks from legacy plain content (books without `blocks` field). */
export function blocksFromLegacyContent(content: string): TextBlock[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ style: classifyLineStyle(text), text }));
}

export function getPageBlocks(page: PaginatedPage): TextBlock[] {
  if (page.blocks && page.blocks.length > 0) return page.blocks;
  if (!page.content.trim()) return [];
  if (page.content.includes("\n\n")) {
    return page.content.split("\n\n").map((text) => ({
      style: classifyLineStyle(text),
      text: text.trim(),
    }));
  }
  return blocksFromLegacyContent(page.content);
}

/** Collapse whitespace and drop consecutive duplicate lines (PDF headers/footers). */
export function normalizeExtractedText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const collapsed = line.replace(/\s+/g, " ").trim();
    if (collapsed === "") {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }
    if (result.length > 0 && result[result.length - 1] === collapsed) {
      continue;
    }
    result.push(collapsed);
  }

  return result.join("\n").trim();
}

export function extractTOC(pages: PaginatedPage[]): TOCItem[] {
  const toc: TOCItem[] = [];
  const headingPattern = /^(CAPÍTULO|Capítulo|CHAPTER|Chapter|\d+\.)\s+.+/i;

  for (const page of pages) {
    for (const block of getPageBlocks(page)) {
      const line = block.text.trim();
      if (block.style === "list-item" && /^libro\s+\d+/i.test(line)) {
        toc.push({ title: line, pageNumber: page.pageNumber });
      } else if (headingPattern.test(line) && line.length < 100) {
        toc.push({ title: line, pageNumber: page.pageNumber });
      }
    }
  }

  if (toc.length === 0 && pages.length > 0) {
    toc.push({ title: "Inicio", pageNumber: 0 });
    if (pages.length > 10) {
      toc.push({ title: "Mitad", pageNumber: Math.floor(pages.length / 2) });
    }
  }

  return toc;
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText({ lineEnforce: true, pageJoiner: "\n" });
      if (result.pages && result.pages.length > 0) {
        return result.pages.map((p) => p.text).join("\n");
      }
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.error("extractTextFromPdfBuffer failed:", err);
    return "No se pudo extraer el texto del PDF. Verifica que el archivo contenga texto seleccionable.";
  }
}

/** Detect legacy books processed with the broken paginator (progressive phrase repetition). */
export function hasLegacyPaginationBug(pages: PaginatedPage[]): boolean {
  for (const page of pages) {
    const blocks = getPageBlocks(page);
    if (blocks.length < 2) continue;
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1].text;
      const curr = blocks[i].text;
      if (curr.startsWith(prev) && curr.length > prev.length && prev.length > 0) {
        return true;
      }
    }
  }
  return false;
}

/** Verify all words from source text appear in order across paginated pages. */
export function assertWordPreservation(fullText: string, pages: PaginatedPage[]): boolean {
  const original = fullText.trim().split(/\s+/).filter(Boolean);
  const recovered = pages.flatMap((p) =>
    getPageBlocks(p).flatMap((b) => b.text.split(/\s+/).filter(Boolean))
  );
  if (original.length !== recovered.length) return false;
  return original.every((word, i) => word === recovered[i]);
}

export function spreadIndex(currentPage: number): number {
  return Math.floor(currentPage / 2);
}

export function pagesForSpread(
  pages: PaginatedPage[],
  spreadIndex: number
): [PaginatedPage | null, PaginatedPage | null] {
  const left = pages[spreadIndex * 2] ?? null;
  const right = pages[spreadIndex * 2 + 1] ?? null;
  return [left, right];
}

export function totalSpreads(totalPages: number): number {
  return Math.ceil(totalPages / 2);
}

export const _test = { countWords, buildBlocks, classifyLineStyle };
