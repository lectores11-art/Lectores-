import type { PositionedTextItem } from "./extract-positioned";
import type { TextBlock, TextBlockStyle } from "./paginator";
import { classifyLineStyle } from "./paginator";

const LIST_ITEM_PATTERN = /^(libro|capítulo|capitulo|chapter)\s+\d+\s*:/i;
const Y_TOLERANCE = 4;
const CENTER_TOLERANCE_RATIO = 0.15;

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

function bodyFontSizeFromItems(items: PositionedTextItem[]): number {
  const sizes = items.map((i) => i.fontSize ?? i.height).filter((s) => s > 0);
  if (sizes.length === 0) return 12;
  return Math.min(...sizes);
}

function inferStyle(text: string, fontSize: number, bodyFontSize: number): TextBlockStyle {
  if (LIST_ITEM_PATTERN.test(text)) return "list-item";
  const base = classifyLineStyle(text);
  if (base !== "paragraph") return base;

  if (fontSize >= bodyFontSize * 1.35) return "title";
  if (fontSize >= bodyFontSize * 1.15) return "subtitle";
  return base;
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
  const blocks: LayoutTextBlock[] = [];

  for (const group of groups) {
    const text = lineText(group);
    if (!text) continue;

    const lineFontSize = Math.max(
      ...group.items.map((i) => i.fontSize ?? i.height).filter((s) => s > 0),
      bodyFontSize
    );
    const style = inferStyle(text, lineFontSize, bodyFontSize);
    const align = inferAlign(group, pageWidth);

    blocks.push({
      style,
      text,
      align,
      fontSize: lineFontSize,
    });
  }

  return blocks;
}

export const _test = {
  groupItemsByLine,
  lineText,
  inferAlign,
  inferStyle,
};
