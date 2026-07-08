export interface PaginatedPage {
  pageNumber: number;
  content: string;
}

export interface TOCItem {
  title: string;
  pageNumber: number;
}

const WORDS_PER_PAGE = 280;

function buildParagraphs(fullText: string): string[] {
  const normalized = fullText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split into blocks separated by blank lines
  const blocks = normalized.split(/\n[ \t]*\n/);

  const paragraphs: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Join wrapped lines within a paragraph. If a line ends with a hyphen,
    // treat it as a word split across lines and glue without space.
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

export function paginateText(fullText: string): PaginatedPage[] {
  const cleaned = fullText.trim();

  if (!cleaned) {
    return [{ pageNumber: 0, content: "Este libro no tiene contenido extraíble." }];
  }

  const paragraphs = buildParagraphs(cleaned);
  const pages: PaginatedPage[] = [];
  let currentPage = "";
  let pageNumber = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/);
    let paragraphChunk = "";

    for (const word of words) {
      const testChunk = paragraphChunk ? `${paragraphChunk} ${word}` : word;
      const testPage = currentPage
        ? `${currentPage}\n\n${testChunk}`
        : testChunk;
      const wordCount = testPage.split(/\s+/).length;

      if (wordCount > WORDS_PER_PAGE && currentPage) {
        pages.push({ pageNumber, content: currentPage.trim() });
        pageNumber++;
        currentPage = testChunk;
        paragraphChunk = testChunk;
      } else {
        currentPage = testPage;
        paragraphChunk = testChunk;
      }
    }
  }

  if (currentPage.trim()) {
    pages.push({ pageNumber, content: currentPage.trim() });
  }

  return pages.length > 0 ? pages : [{ pageNumber: 0, content: cleaned }];
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
    // pdf-parse v2 API: new PDFParse({ data }).getText()
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      // Prefer per-page text (keeps page breaks) and fall back to combined text
      if (result.pages && result.pages.length > 0) {
        return result.pages.map((p) => p.text).join("\n\n");
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

export function spreadIndex(currentPage: number): number {
  return Math.floor(currentPage / 2);
}

export function pagesForSpread(pages: PaginatedPage[], spreadIndex: number): [PaginatedPage | null, PaginatedPage | null] {
  const left = pages[spreadIndex * 2] ?? null;
  const right = pages[spreadIndex * 2 + 1] ?? null;
  return [left, right];
}

export function totalSpreads(totalPages: number): number {
  return Math.ceil(totalPages / 2);
}
