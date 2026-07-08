export interface PaginatedPage {
  pageNumber: number;
  content: string;
}

export interface TOCItem {
  title: string;
  pageNumber: number;
}

const WORDS_PER_PAGE = 280;

export function paginateText(fullText: string): PaginatedPage[] {
  const cleaned = fullText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    return [{ pageNumber: 0, content: "Este libro no tiene contenido extraíble." }];
  }

  const paragraphs = cleaned.split(/\n\n+/);
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
    // pdf-parse works natively in Node.js without worker configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = (await import("pdf-parse")) as any;
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
      pdfParseModule.default ?? pdfParseModule;
    const result = await pdfParse(buffer);
    return result.text || "";
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
