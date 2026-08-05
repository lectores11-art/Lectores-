/**
 * Client-only page packing.
 *
 * Truth signal: render blocks together in a fixed-height clone of `.book-page-body`
 * and use scrollHeight > clientHeight. Summing per-block offsetHeights is NOT
 * reliable (margin collapse, :first-of-type, stacking) and caused clipped lines.
 */
import {
  mergeContinuationParagraphs,
  type PaginatedPage,
  type TextBlock,
} from "./paginator";

export type MeasurePackOptions = {
  columnWidthPx: number;
  /** Full clientHeight of left `.book-page-body` (includes padding). */
  leftHeightPx: number;
  /** Full clientHeight of right `.book-page-body` (includes padding). */
  rightHeightPx: number;
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

function renderBlockEl(block: TextBlock, fontSize: number): HTMLElement {
  const tag =
    block.style === "title" || block.style === "heading" ? "h2" : "p";
  const el = document.createElement(tag);
  el.className = classNameForBlock(block);
  el.style.fontSize = `${fontSizeForBlock(block, fontSize)}px`;
  el.textContent = block.text;
  return el;
}

/** Live body metrics — use full client box (padding included); probe mirrors CSS. */
export function pageBodyMetrics(el: HTMLElement): {
  widthPx: number;
  heightPx: number;
} {
  return {
    widthPx: Math.max(80, Math.floor(el.clientWidth)),
    heightPx: Math.max(80, Math.floor(el.clientHeight)),
  };
}

function createProbeColumn(columnWidthPx: number): {
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
    `width:${columnWidthPx}px`,
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
    "line-height:1.75",
  ].join(";");

  const column = document.createElement("div");
  column.className = "book-page-body";
  // Mirror reader body: same padding-bottom, fixed height set per page, clip overflow.
  column.style.cssText = [
    `width:${columnWidthPx}px`,
    "box-sizing:border-box",
    "padding-bottom:1.25rem",
    "overflow:hidden",
    "min-height:0",
    "flex:none",
  ].join(";");

  page.appendChild(column);
  host.appendChild(page);
  document.body.appendChild(host);
  return { host, column };
}

function overflows(column: HTMLElement): boolean {
  // Subpixel tolerance — only treat real overflow as failure.
  return column.scrollHeight > column.clientHeight + 1;
}

/**
 * Binary-search word split so the first chunk fits alone in an empty probe column.
 */
function splitParagraphToFitProbe(
  column: HTMLElement,
  block: TextBlock,
  fontSize: number
): TextBlock[] {
  const words = block.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [{ ...block }];

  let lo = 1;
  let hi = words.length;
  let best = 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const trial: TextBlock = {
      ...block,
      text: words.slice(0, mid).join(" "),
      continued: block.continued === true,
    };
    column.replaceChildren(renderBlockEl(trial, fontSize));
    if (!overflows(column)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  column.replaceChildren();

  if (best >= words.length) return [{ ...block }];

  const first: TextBlock = {
    ...block,
    text: words.slice(0, best).join(" "),
    continued: block.continued === true,
  };
  const rest: TextBlock = {
    ...block,
    text: words.slice(best).join(" "),
    continued: true,
  };
  return [first, rest];
}

function serializeBlocks(blocks: TextBlock[]): string {
  return blocks.map((b) => b.text).join("\n\n");
}

/**
 * With existing page content already in `column`, find how much of `block` still
 * fits. Returns [chunk, remainder] or null if nothing fits (caller should
 * flush the page).
 */
function splitParagraphIntoRemaining(
  column: HTMLElement,
  block: TextBlock,
  fontSize: number
): TextBlock[] | null {
  if (block.style !== "paragraph") return null;

  const words = block.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let lo = 1;
  let hi = words.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const trial: TextBlock = {
      ...block,
      text: words.slice(0, mid).join(" "),
      continued: block.continued === true,
    };
    const el = renderBlockEl(trial, fontSize);
    column.appendChild(el);
    const ok = !overflows(column);
    column.removeChild(el);
    if (ok) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best <= 0) return null;

  const first: TextBlock = {
    ...block,
    text: words.slice(0, best).join(" "),
    continued: block.continued === true,
  };
  const restWords = words.slice(best);
  if (restWords.length === 0) return [first];

  return [
    first,
    {
      ...block,
      text: restWords.join(" "),
      continued: true,
    },
  ];
}

/**
 * Pack by overflow probe: add blocks until the real stacked layout no longer fits.
 * When a paragraph does not fit the remainder of a page, split it so the page
 * fills (avoids large blank regions after a heading / short end of paragraph).
 */
export function measureAndPackBlocks(
  blocks: TextBlock[],
  options: MeasurePackOptions
): PaginatedPage[] {
  if (typeof document === "undefined") {
    throw new Error("measureAndPackBlocks requires a browser document");
  }

  const fontSize = options.fontSize || PACK_FONT_SIZE;
  const leftH = Math.max(80, Math.floor(options.leftHeightPx));
  const rightH = Math.max(80, Math.floor(options.rightHeightPx));
  const { host, column } = createProbeColumn(options.columnWidthPx);

  function limitFor(pageIndex: number): number {
    return pageIndex % 2 === 0 ? leftH : rightH;
  }

  try {
    const queue = [...mergeContinuationParagraphs(blocks)];
    const pages: PaginatedPage[] = [];

    if (queue.length === 0) {
      const fallback = "Este libro no tiene contenido extraíble.";
      return [
        {
          pageNumber: 0,
          content: fallback,
          blocks: [{ style: "paragraph", text: fallback }],
        },
      ];
    }

    let pageBlocks: TextBlock[] = [];

    function flushPage() {
      if (pageBlocks.length === 0) return;
      pages.push({
        pageNumber: pages.length,
        content: serializeBlocks(pageBlocks),
        blocks: [...pageBlocks],
      });
      pageBlocks = [];
      column.replaceChildren();
    }

    /** Re-render current pageBlocks into the probe (after splits / retries). */
    function paintPageBlocks() {
      column.replaceChildren(
        ...pageBlocks.map((b) => renderBlockEl(b, fontSize))
      );
    }

    let guard = 0;
    const maxSteps = Math.max(10_000, queue.length * 40);

    while (queue.length > 0) {
      if (++guard > maxSteps) {
        throw new Error("measureAndPackBlocks: exceeded safety iteration cap");
      }

      const limit = limitFor(pages.length);
      column.style.height = `${limit}px`;

      if (pageBlocks.length === 0) {
        column.replaceChildren();
      }

      const next = queue[0];
      const el = renderBlockEl(next, fontSize);
      column.appendChild(el);

      if (!overflows(column)) {
        pageBlocks.push(next);
        queue.shift();
        continue;
      }

      // Does not fit with current page content.
      column.removeChild(el);

      if (pageBlocks.length === 0) {
        // Alone and still too tall — split paragraphs only.
        if (next.style === "paragraph") {
          const [first, ...rest] = splitParagraphToFitProbe(
            column,
            next,
            fontSize
          );
          queue.shift();
          column.replaceChildren(renderBlockEl(first, fontSize));
          if (overflows(column) && first.text.trim().split(/\s+/).length <= 1) {
            pageBlocks.push(first);
            flushPage();
          } else if (overflows(column)) {
            const words = first.text.trim().split(/\s+/).filter(Boolean);
            const one = { ...first, text: words[0] ?? first.text };
            const leftover = words.slice(1).join(" ");
            pageBlocks.push(one);
            flushPage();
            if (leftover) {
              queue.unshift({ ...first, text: leftover, continued: true });
            }
            if (rest.length) queue.unshift(...rest);
          } else {
            pageBlocks.push(first);
            if (rest.length) queue.unshift(...rest);
          }
          continue;
        }

        pageBlocks.push(next);
        queue.shift();
        flushPage();
        continue;
      }

      // Page already has content. Fill remaining space with the start of a
      // paragraph instead of leaving a large blank and moving the whole block.
      if (next.style === "paragraph") {
        paintPageBlocks();
        const pieces = splitParagraphIntoRemaining(column, next, fontSize);
        if (pieces && pieces[0]?.text.trim()) {
          queue.shift();
          const first = pieces[0];
          column.appendChild(renderBlockEl(first, fontSize));
          pageBlocks.push(first);
          if (pieces[1]) queue.unshift(pieces[1]);
          flushPage();
          continue;
        }
      }

      // Non-paragraph (heading/list) or nothing fits in the remainder — new page.
      flushPage();
    }

    flushPage();
    return pages;
  } finally {
    host.remove();
  }
}

/** @deprecated kept for call sites that imported the old name */
export function contentBoxHeightPx(el: HTMLElement): number {
  return pageBodyMetrics(el).heightPx;
}

/** @deprecated kept for call sites that imported the old name */
export function contentBoxWidthPx(el: HTMLElement): number {
  return pageBodyMetrics(el).widthPx;
}

export { PACK_FONT_SIZE };
