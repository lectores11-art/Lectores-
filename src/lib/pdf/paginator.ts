export type TextBlockStyle = "title" | "subtitle" | "list-item" | "heading" | "paragraph";

export interface TextBlock {
  style: TextBlockStyle;
  text: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  /** True when this block continues a paragraph split across a page break. */
  continued?: boolean;
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

/**
 * Visual line budget per half-page (server-side estimate).
 * Half-page column ≈ 50–55 chars at 17px; body fits ~20–22 lines on a
 * typical laptop after padding (tuned against live reader fill).
 */
export const LEFT_PAGE_LINES = 20;
export const RIGHT_PAGE_LINES = 22;

/** Approx characters per wrapped line in a reader half-page. */
export const CHARS_PER_LINE = 48;

/** @deprecated Use LEFT_PAGE_WORDS / RIGHT_PAGE_WORDS per page index. */
export const READER_WORDS_PER_PAGE = LEFT_PAGE_WORDS;

/** Bump when extraction/pagination logic changes; stored on each book row. */
export const PIPELINE_VERSION = 5;

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

function linesLimitForPage(pageIndex: number): number {
  return pageIndex % 2 === 0 ? LEFT_PAGE_LINES : RIGHT_PAGE_LINES;
}

/** Visual line cost — includes margins from reader CSS (`.book-para`, titles). */
export function blockLineCost(block: TextBlock): number {
  switch (block.style) {
    case "title":
      return 3;
    case "subtitle":
    case "heading":
      return 3;
    case "list-item":
      return 2;
    case "paragraph": {
      const explicitLines = block.text.split("\n").filter(Boolean).length;
      const wrapped = Math.ceil(block.text.length / CHARS_PER_LINE);
      // +1 accounts for margin-bottom on .book-para
      return Math.max(1, explicitLines, wrapped) + 1;
    }
    default:
      return 1;
  }
}

/** Estimate rendered height in px for a block at the given font size. */
export function estimateBlockHeightPx(block: TextBlock, fontSize: number): number {
  // Match globals.css: line-height 1.8, .book-para margin-bottom 0.85rem
  // Slight inflation (+6%) so we never pack past the visible box.
  const bodyLine = fontSize * 1.8;
  const paraMargin = fontSize * 0.85;
  let raw: number;
  switch (block.style) {
    case "title":
      raw = (fontSize + 4) * 1.3 + fontSize * 0.7;
      break;
    case "subtitle":
      raw = (fontSize + 1) * 1.45 + fontSize * 0.85;
      break;
    case "heading":
      raw = (fontSize + 3) * 1.35 + fontSize * 1.35;
      break;
    case "list-item":
      // line-height 1.45 + margin-bottom 0.2rem
      raw = fontSize * 1.45 + fontSize * 0.25;
      break;
    case "paragraph": {
      const lines = Math.max(1, Math.ceil(block.text.length / CHARS_PER_LINE));
      raw = lines * bodyLine + paraMargin;
      break;
    }
    default:
      raw = bodyLine;
  }
  return Math.ceil(raw * 1.06);
}

/** Flatten stored pages back into a single ordered block stream. */
export function flattenPageBlocks(pages: PaginatedPage[]): TextBlock[] {
  return mergeContinuationParagraphs(pages.flatMap((page) => getPageBlocks(page)));
}

/**
 * Detect paragraph chunks that were split mid-sentence (legacy word pagination
 * or height splits) so we can rejoin them before reflow.
 */
export function isParagraphContinuation(prev: string, next: string): boolean {
  const a = prev.trim();
  const b = next.trim();
  if (!a || !b) return false;
  if (a.endsWith("-")) return true;
  // Continuation of the same sentence (e.g. "del" + "año pasado...")
  if (/^[a-záéíóúñüàèìòù]/.test(b)) return true;
  // Split mid-clause without terminal punctuation (e.g. "...Anecdota" + "Oxoniensia.")
  if (!/[.!?…]["»')"\]]*$/.test(a)) return true;
  return false;
}

/** Rejoin mid-sentence paragraph fragments into single blocks. */
export function mergeContinuationParagraphs(blocks: TextBlock[]): TextBlock[] {
  const merged: TextBlock[] = [];

  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    const shouldMerge =
      prev &&
      prev.style === "paragraph" &&
      block.style === "paragraph" &&
      (block.continued === true ||
        prev.continued === true ||
        isParagraphContinuation(prev.text, block.text));

    if (shouldMerge && prev) {
      const joiner = prev.text.endsWith("-") ? "" : " ";
      const nextText = prev.text.endsWith("-")
        ? block.text.replace(/^\s+/, "")
        : block.text;
      prev.text = `${prev.text.replace(/-$/, "")}${joiner}${nextText}`.replace(/\s+/g, " ").trim();
      prev.continued = false;
      continue;
    }

    merged.push({ ...block, continued: false });
  }

  return merged;
}

/**
 * Split a paragraph so each chunk fits within maxHeightPx.
 * Non-paragraph blocks are returned as-is (never split).
 * Chunks after the first are marked `continued` (no indent in the reader).
 */
export function splitBlockToFit(
  block: TextBlock,
  maxHeightPx: number,
  fontSize: number
): TextBlock[] {
  if (block.style !== "paragraph") return [block];
  if (estimateBlockHeightPx(block, fontSize) <= maxHeightPx) {
    return [{ ...block }];
  }

  const words = block.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [block];

  const chunks: TextBlock[] = [];
  let current: string[] = [];

  for (const word of words) {
    const trial = [...current, word].join(" ");
    const trialHeight = estimateBlockHeightPx({ ...block, text: trial }, fontSize);
    if (trialHeight > maxHeightPx && current.length > 0) {
      chunks.push({
        ...block,
        text: current.join(" "),
        continued: block.continued === true || chunks.length > 0,
      });
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    chunks.push({
      ...block,
      text: current.join(" "),
      continued: block.continued === true || chunks.length > 0,
    });
  }
  return chunks.length > 0 ? chunks : [block];
}

export type HeightPaginationOptions = {
  /** Available content height for even pages (left). */
  leftHeightPx: number;
  /** Available content height for odd pages (right). */
  rightHeightPx: number;
  fontSize: number;
};

/**
 * Pack already-measured blocks into pages without exceeding page height.
 * Never drops content. Does not split blocks — callers must pre-split any
 * block taller than a full page (see reader DOM measure pass).
 * If a block does not fit the remaining space, it starts on the next page.
 */
export function packBlocksWithMeasuredHeights(
  blocks: TextBlock[],
  heights: number[],
  options: Pick<HeightPaginationOptions, "leftHeightPx" | "rightHeightPx">
): PaginatedPage[] {
  const { leftHeightPx, rightHeightPx } = options;
  const minHeight = 80;

  if (blocks.length === 0) {
    const fallback = "Este libro no tiene contenido extraíble.";
    return [
      {
        pageNumber: 0,
        content: fallback,
        blocks: [{ style: "paragraph", text: fallback }],
      },
    ];
  }

  if (blocks.length !== heights.length) {
    throw new Error(
      `packBlocksWithMeasuredHeights: blocks (${blocks.length}) != heights (${heights.length})`
    );
  }

  function heightForPage(pageIndex: number): number {
    const raw = pageIndex % 2 === 0 ? leftHeightPx : rightHeightPx;
    return Math.max(minHeight, raw);
  }

  const pages: PaginatedPage[] = [];
  let pageBlocks: TextBlock[] = [];
  let usedHeight = 0;

  function flushPage() {
    if (pageBlocks.length === 0) return;
    pages.push({
      pageNumber: pages.length,
      content: serializeBlocks(pageBlocks),
      blocks: [...pageBlocks],
    });
    pageBlocks = [];
    usedHeight = 0;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const h = Math.max(0, heights[i] ?? 0);
    const limit = heightForPage(pages.length);

    if (pageBlocks.length === 0) {
      pageBlocks.push(block);
      usedHeight = h;
      // Alone on the page and already fills it — advance (may slightly overflow; CSS safety).
      if (h >= limit) flushPage();
      continue;
    }

    if (usedHeight + h > limit) {
      flushPage();
      i -= 1;
      continue;
    }

    pageBlocks.push(block);
    usedHeight += h;
  }

  flushPage();
  return pages;
}

/**
 * Paginate by measured/estimated pixel height (reader reflow + safer uploads).
 * Atomic non-paragraph blocks are never split; paragraphs may split mid-text
 * with `continued` markers so the reader does not indent mid-sentence.
 */
export function paginateBlocksByHeight(
  blocks: TextBlock[],
  options: HeightPaginationOptions
): PaginatedPage[] {
  const { leftHeightPx, rightHeightPx, fontSize } = options;
  const minHeight = 80;
  const minSplitPx = fontSize * 2.5;

  const source = mergeContinuationParagraphs(blocks);

  if (source.length === 0) {
    const fallback = "Este libro no tiene contenido extraíble.";
    return [
      {
        pageNumber: 0,
        content: fallback,
        blocks: [{ style: "paragraph", text: fallback }],
      },
    ];
  }

  function heightForPage(pageIndex: number): number {
    const raw = pageIndex % 2 === 0 ? leftHeightPx : rightHeightPx;
    return Math.max(minHeight, raw);
  }

  const pages: PaginatedPage[] = [];
  let pageBlocks: TextBlock[] = [];
  let usedHeight = 0;

  function flushPage() {
    if (pageBlocks.length === 0) return;
    pages.push({
      pageNumber: pages.length,
      content: serializeBlocks(pageBlocks),
      blocks: [...pageBlocks],
    });
    pageBlocks = [];
    usedHeight = 0;
  }

  function placeBlock(block: TextBlock) {
    pageBlocks.push(block);
    usedHeight += estimateBlockHeightPx(block, fontSize);
    if (usedHeight >= heightForPage(pages.length)) {
      flushPage();
    }
  }

  const queue: TextBlock[] = [...source];

  while (queue.length > 0) {
    const block = queue.shift()!;
    const limit = heightForPage(pages.length);
    const spaceLeft = limit - usedHeight;
    const h = estimateBlockHeightPx(block, fontSize);

    if (h <= spaceLeft) {
      placeBlock(block);
      continue;
    }

    // Empty page but block taller than the page — split paragraphs only.
    if (pageBlocks.length === 0) {
      if (block.style === "paragraph") {
        const pieces = splitBlockToFit(block, limit, fontSize);
        const first = pieces.shift()!;
        placeBlock(first);
        queue.unshift(...pieces);
      } else {
        placeBlock(block);
        flushPage();
      }
      continue;
    }

    // Fill remaining space with the start of a paragraph, continue on next page.
    if (block.style === "paragraph" && spaceLeft >= minSplitPx) {
      const pieces = splitBlockToFit(block, spaceLeft, fontSize);
      const first = pieces[0];
      const firstH = estimateBlockHeightPx(first, fontSize);

      if (firstH <= spaceLeft && first.text.trim()) {
        placeBlock(first);
        flushPage();
        const restText = pieces
          .slice(1)
          .map((p) => p.text)
          .join(" ")
          .trim();
        // splitBlockToFit may return only one piece that is still the full text
        // when spaceLeft is tiny relative to first word — handle remainder.
        if (pieces.length === 1) {
          // First piece consumed words that fit; rebuild remainder from original.
          const usedWords = first.text.trim().split(/\s+/).filter(Boolean);
          const allWords = block.text.trim().split(/\s+/).filter(Boolean);
          const restWords = allWords.slice(usedWords.length);
          if (restWords.length > 0) {
            queue.unshift({
              ...block,
              text: restWords.join(" "),
              continued: true,
            });
          }
        } else if (restText) {
          queue.unshift({
            ...block,
            text: restText,
            continued: true,
          });
        }
        continue;
      }
    }

    flushPage();
    queue.unshift(block);
  }

  flushPage();
  return pages;
}

/**
 * Paginate structured blocks by visual line height (Level B upload path).
 * Atomic blocks (especially list-item) are never split across pages.
 */
export function paginateBlocksByLines(blocks: TextBlock[]): PaginatedPage[] {
  // Convert line budgets to a height model shared with the reader (~17px body).
  const fontSize = 17;
  const linePx = fontSize * 1.8;
  return paginateBlocksByHeight(blocks, {
    leftHeightPx: LEFT_PAGE_LINES * linePx,
    rightHeightPx: RIGHT_PAGE_LINES * linePx,
    fontSize,
  });
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

export const _test = { countWords, buildBlocks, classifyLineStyle, blockLineCost, linesLimitForPage };
