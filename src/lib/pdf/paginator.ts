export interface PaginatedPage {
  pageNumber: number;
  content: string;
}

export interface TOCItem {
  title: string;
  pageNumber: number;
}

/** Words per reader page — tuned to fit one half-spread without vertical scroll. */
export const READER_WORDS_PER_PAGE = 120;

/** Bump when extraction/pagination logic changes; stored on each book row. */
export const PIPELINE_VERSION = 1;

/** Safety cap for content_json size in DB. */
export const MAX_STORED_PAGES = 1500;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function joinPageParagraphs(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function buildParagraphs(fullText: string): string[] {
  const normalized = fullText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const blocks = normalized.split(/\n[ \t]*\n/);

  const paragraphs: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let paragraph = "";
    for (const line of lines) {
      if (!paragraph) {
        paragraph = line;
      } else if (paragraph.endsWith("-")) {
        paragraph = paragraph.slice(0, -1) + line;
      } else {
        paragraph += " " + line;
      }
    }
    paragraphs.push(paragraph.trim());
  }

  return paragraphs;
}

/**
 * Split normalized book text into reader pages. Each page holds up to
 * READER_WORDS_PER_PAGE words; paragraphs may continue on the next page.
 */
export function paginateText(fullText: string): PaginatedPage[] {
  const cleaned = fullText.trim();

  if (!cleaned) {
    return [{ pageNumber: 0, content: "Este libro no tiene contenido extraíble." }];
  }

  const paragraphs = buildParagraphs(cleaned);
  const pages: PaginatedPage[] = [];
  let pageParagraphs: string[] = [];
  let pageWordCount = 0;

  function flushPage() {
    if (pageParagraphs.length === 0) return;
    pages.push({
      pageNumber: pages.length,
      content: joinPageParagraphs(pageParagraphs),
    });
    pageParagraphs = [];
    pageWordCount = 0;
  }

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let index = 0;

    while (index < words.length) {
      const spaceLeft = READER_WORDS_PER_PAGE - pageWordCount;
      if (spaceLeft <= 0) {
        flushPage();
        continue;
      }

      const take = Math.min(spaceLeft, words.length - index);
      const chunk = words.slice(index, index + take).join(" ");
      index += take;

      pageParagraphs.push(chunk);
      pageWordCount += take;

      if (pageWordCount >= READER_WORDS_PER_PAGE) {
        flushPage();
      }
    }
  }

  flushPage();

  return pages.length > 0 ? pages : [{ pageNumber: 0, content: cleaned }];
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
    const lines = page.content.split("\n");
    for (const line of lines) {
      if (headingPattern.test(line.trim()) && line.trim().length < 100) {
        toc.push({ title: line.trim(), pageNumber: page.pageNumber });
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
      const result = await parser.getText();
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
    const blocks = page.content.split("\n\n").map((b) => b.trim()).filter(Boolean);
    if (blocks.length < 2) continue;
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1];
      const curr = blocks[i];
      if (curr.startsWith(prev) && curr.length > prev.length && prev.length > 0) {
        return true;
      }
    }
  }
  return false;
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

// Exported for tests
export const _test = { countWords, buildParagraphs };
