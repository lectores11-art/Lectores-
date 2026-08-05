import type { PositionedTextItem } from "./extract-positioned";
import type { TextBlock, TextBlockStyle } from "./paginator";
import { classifyLineStyle, shouldJoinProseLines } from "./paginator";

const LIST_ITEM_PATTERN = /^(libro|capítulo|capitulo|chapter)\s+\d+\s*:/i;
const Y_TOLERANCE = 4;
const CENTER_TOLERANCE_RATIO = 0.12;

export type TextAlign = "left" | "center" | "right";

export interface LayoutTextBlock extends TextBlock {
  align?: TextAlign;
  fontSize?: number;
}

interface LineGroup {
  y: number;
  items: PositionedTextItem[];
}

function groupItemsByLine(items: PositionedTextItem[]): LineGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (Math.abs(a.y - b.y) > Y_TOLERANCE) return a.y - b.y;
    return a.x - b.x;
  });

  const groups: LineGroup[] = [];

  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.items[0].pageIndex === item.pageIndex &&
      Math.abs(last.y - item.y) <= Y_TOLERANCE
    ) {
      last.items.push(item);
    } else {
      groups.push({ y: item.y, items: [item] });
    }
  }

  return groups;
}

function lineText(group: LineGroup): string {
  return group.items
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function lineCenterX(group: LineGroup): number {
  const sorted = [...group.items].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first.x + (last.x + last.width - first.x) / 2;
}

function inferAlign(group: LineGroup, pageWidth: number): TextAlign {
  const centerX = lineCenterX(group);
  const pageCenter = pageWidth / 2;
  const tolerance = pageWidth * CENTER_TOLERANCE_RATIO;
  if (Math.abs(centerX - pageCenter) <= tolerance) return "center";
  if (centerX < pageWidth * 0.35) return "left";
  if (centerX > pageWidth * 0.65) return "right";
  return "left";
}

/**
 * Dominant body size (mode). Using min() treated footnotes as body and promoted
 * every normal line to title/subtitle (centered short lines in the reader).
 */
function bodyFontSizeFromItems(items: PositionedTextItem[]): number {
  const sizes = items
    .map((i) => i.fontSize ?? i.height)
    .filter((s) => s > 0);
  if (sizes.length === 0) return 12;

  const rounded = sizes.map((s) => Math.round(s * 2) / 2);
  const counts = new Map<number, number>();
  for (const s of rounded) counts.set(s, (counts.get(s) || 0) + 1);

  let best = rounded[0]!;
  let bestCount = 0;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

function inferStyle(
  text: string,
  fontSize: number,
  bodyFontSize: number,
  align: TextAlign
): TextBlockStyle {
  if (LIST_ITEM_PATTERN.test(text)) return "list-item";
  const base = classifyLineStyle(text);

  // Named headings / TOC labels keep their style (CSS centers them).
  if (base !== "paragraph") return base;

  // Size-based titles only when centered (real headings, not body wrap lines).
  if (align === "center" && fontSize >= bodyFontSize * 1.45) return "title";
  if (align === "center" && fontSize >= bodyFontSize * 1.2) return "subtitle";

  // Short body lines from PDF wrap must stay paragraphs (reader justifies them).
  return "paragraph";
}

/**
 * Join consecutive prose lines into flowing paragraphs (like a real book page).
 * Keeps TOC / titles / list-items as their own blocks.
 */
export function mergeProseLayoutBlocks(
  blocks: LayoutTextBlock[]
): LayoutTextBlock[] {
  const out: LayoutTextBlock[] = [];

  for (const block of blocks) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.style === "paragraph" &&
      block.style === "paragraph" &&
      shouldJoinProseLines(prev.text, block.text)
    ) {
      if (prev.text.endsWith("-")) {
        prev.text = prev.text.slice(0, -1) + block.text;
      } else {
        prev.text = `${prev.text} ${block.text}`;
      }
      prev.align = "left";
      continue;
    }

    if (block.style === "paragraph") {
      out.push({ ...block, align: "left" });
    } else {
      out.push({ ...block });
    }
  }

  return out;
}

/**
 * Convert positioned PDF text runs into layout-enriched blocks.
 */
export function inferLayoutBlocks(
  items: PositionedTextItem[],
  pageWidth: number
): LayoutTextBlock[] {
  if (items.length === 0 || pageWidth <= 0) return [];

  const bodyFontSize = bodyFontSizeFromItems(items);
  const groups = groupItemsByLine(items);
  const lineBlocks: LayoutTextBlock[] = [];

  for (const group of groups) {
    const text = lineText(group);
    if (!text) continue;

    const sizes = group.items
      .map((i) => i.fontSize ?? i.height)
      .filter((s) => s > 0);
    const lineFontSize = sizes.length > 0 ? Math.max(...sizes) : bodyFontSize;
    const align = inferAlign(group, pageWidth);
    const style = inferStyle(text, lineFontSize, bodyFontSize, align);

    lineBlocks.push({
      style,
      text,
      // Body prose is always left; reader CSS justifies paragraphs.
      align: style === "paragraph" ? "left" : align,
      fontSize: lineFontSize,
    });
  }

  return mergeProseLayoutBlocks(lineBlocks);
}

export const _test = {
  groupItemsByLine,
  lineText,
  inferAlign,
  inferStyle,
  bodyFontSizeFromItems,
  mergeProseLayoutBlocks,
};
