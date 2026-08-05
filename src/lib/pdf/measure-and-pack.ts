/**
 * Client-only: measure reader blocks with real CSS (Literata / .book-para) and
 * pack pages with {@link packBlocksWithMeasuredHeights}.
 */
import {
  mergeContinuationParagraphs,
  packBlocksWithMeasuredHeights,
  type PaginatedPage,
  type TextBlock,
} from "./paginator";

export type MeasurePackOptions = {
  columnWidthPx: number;
  leftHeightPx: number;
  rightHeightPx: number;
  /** Pack font size — launch default matches BookReader (16). */
  fontSize: number;
};

const PACK_FONT_SIZE = 16;

function classNameForBlock(block: TextBlock): string {
  switch (block.style) {
    case "title":
      return "book-title";
    case "subtitle":
      return "book-subtitle";
    case "list-item":
      return "book-list-item";
    case "heading":
      return "book-heading";
    default:
      return block.continued
        ? "book-para book-para-continued"
        : "book-para";
  }
}

function fontSizeForBlock(block: TextBlock, base: number): number {
  switch (block.style) {
    case "title":
      return base + 4;
    case "subtitle":
      return base + 1;
    case "heading":
      return base + 3;
    default:
      return base;
  }
}

function createMeasureHost(columnWidthPx: number): {
  host: HTMLElement;
  column: HTMLElement;
} {
  const host = document.createElement("div");
  host.className = "reader-shell reader-light reader-serif";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:absolute",
    "left:-10000px",
    "top:0",
    "visibility:hidden",
    "pointer-events:none",
    "height:auto",
    "overflow:visible",
    `width:${Math.max(120, columnWidthPx)}px`,
  ].join(";");

  const page = document.createElement("div");
  page.className = "book-page";
  page.style.cssText = [
    "height:auto",
    "max-height:none",
    "padding:0",
    "overflow:visible",
    "background:transparent",
    "box-shadow:none",
  ].join(";");

  const column = document.createElement("div");
  column.className = "book-page-body";
  column.style.cssText = [
    `width:${Math.max(120, columnWidthPx)}px`,
    "padding-bottom:0",
    "overflow:visible",
    "min-height:0",
  ].join(";");

  page.appendChild(column);
  host.appendChild(page);
  document.body.appendChild(host);
  return { host, column };
}

function renderBlockEl(block: TextBlock, fontSize: number): HTMLElement {
  const tag =
    block.style === "title" || block.style === "heading" ? "h2" : "p";
  const el = document.createElement(tag);
  el.className = classNameForBlock(block);
  el.style.fontSize = `${fontSizeForBlock(block, fontSize)}px`;
  el.textContent = block.text;
  return el;
}

/** Measure a single block's offsetHeight in the reader column. */
export function measureBlockHeightPx(
  column: HTMLElement,
  block: TextBlock,
  fontSize: number
): number {
  const el = renderBlockEl(block, fontSize);
  column.appendChild(el);
  const h = el.offsetHeight;
  column.removeChild(el);
  return Math.max(0, h);
}

/**
 * Split a paragraph by words so each chunk fits maxHeightPx (measured).
 * Non-paragraphs are never split.
 */
export function splitBlockToFitMeasured(
  column: HTMLElement,
  block: TextBlock,
  maxHeightPx: number,
  fontSize: number
): TextBlock[] {
  if (block.style !== "paragraph") return [{ ...block }];

  const fullH = measureBlockHeightPx(column, block, fontSize);
  if (fullH <= maxHeightPx) return [{ ...block }];

  const words = block.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [{ ...block }];

  const chunks: TextBlock[] = [];
  let current: string[] = [];

  for (const word of words) {
    const trial = [...current, word].join(" ");
    const trialH = measureBlockHeightPx(
      column,
      { ...block, text: trial },
      fontSize
    );
    if (trialH > maxHeightPx && current.length > 0) {
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
  return chunks.length > 0 ? chunks : [{ ...block }];
}

/**
 * Measure blocks in a hidden reader column and pack into pages.
 * Must run in the browser (uses document + computed CSS).
 */
export function measureAndPackBlocks(
  blocks: TextBlock[],
  options: MeasurePackOptions
): PaginatedPage[] {
  if (typeof document === "undefined") {
    throw new Error("measureAndPackBlocks requires a browser document");
  }

  const fontSize = options.fontSize || PACK_FONT_SIZE;
  const pageCap = Math.min(options.leftHeightPx, options.rightHeightPx);
  const { host, column } = createMeasureHost(options.columnWidthPx);

  try {
    const source = mergeContinuationParagraphs(blocks);
    const prepared: TextBlock[] = [];
    const heights: number[] = [];

    for (const block of source) {
      const pieces = splitBlockToFitMeasured(
        column,
        block,
        Math.max(80, pageCap),
        fontSize
      );
      for (const piece of pieces) {
        prepared.push(piece);
        heights.push(measureBlockHeightPx(column, piece, fontSize));
      }
    }

    return packBlocksWithMeasuredHeights(prepared, heights, {
      leftHeightPx: options.leftHeightPx,
      rightHeightPx: options.rightHeightPx,
    });
  } finally {
    host.remove();
  }
}

export { PACK_FONT_SIZE };
