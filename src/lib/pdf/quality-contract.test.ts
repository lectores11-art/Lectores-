import { describe, expect, it } from "vitest";
import { inferLayoutBlocks } from "./layout-inference";
import type { PositionedTextItem } from "./extract-positioned";
import {
  assertPackedPageQuality,
  needsDomPack,
  packBlocksWithMeasuredHeights,
  packMetricsStale,
  PIPELINE_VERSION,
  ESTIMATED_PIPELINE_VERSION,
  type TextBlock,
} from "./paginator";

const PAGE_WIDTH = 600;

function leftLine(
  y: number,
  text: string,
  fontSize = 11
): PositionedTextItem {
  return {
    text,
    x: 72,
    y,
    width: Math.min(420, text.length * 7),
    height: fontSize,
    pageIndex: 0,
    fontSize,
  };
}

function centeredLine(
  y: number,
  text: string,
  fontSize = 12
): PositionedTextItem {
  const width = text.length * 8;
  return {
    text,
    x: (PAGE_WIDTH - width) / 2,
    y,
    width,
    height: fontSize,
    pageIndex: 0,
    fontSize,
  };
}

describe("quality contract pipeline flags", () => {
  it("estimated upload needs DOM pack; final does not", () => {
    expect(PIPELINE_VERSION).toBe(12);
    expect(ESTIMATED_PIPELINE_VERSION).toBe(7);
    expect(needsDomPack(ESTIMATED_PIPELINE_VERSION)).toBe(true);
    expect(needsDomPack(PIPELINE_VERSION)).toBe(false);
    expect(needsDomPack(0)).toBe(false);
  });

  it("detects stale pack metrics when viewport grows (e.g. Cursor → 15\" Mac)", () => {
    const small = {
      widthPx: 400,
      leftHeightPx: 400,
      rightHeightPx: 420,
      fontSize: 16,
    };
    const large = {
      widthPx: 480,
      leftHeightPx: 620,
      rightHeightPx: 640,
      fontSize: 16,
    };
    expect(packMetricsStale(small, large)).toBe(true);
    expect(packMetricsStale(large, large)).toBe(false);
    expect(packMetricsStale(null, large)).toBe(true);
  });
});

describe("G1/G2 pack quality (measured heights)", () => {
  it("G1: no page exceeds its height limit", () => {
    const blocks: TextBlock[] = Array.from({ length: 12 }, (_, i) => ({
      style: "paragraph" as const,
      text: `párrafo ${i}`,
    }));
    const heights = blocks.map(() => 40);
    const options = { leftHeightPx: 100, rightHeightPx: 100 };
    const pages = packBlocksWithMeasuredHeights(blocks, heights, options);

    for (let p = 0; p < pages.length; p++) {
      const used = (pages[p].blocks ?? []).length * 40;
      const limit = 100;
      expect(used).toBeLessThanOrEqual(limit);
    }

    const check = assertPackedPageQuality(pages, heights, options);
    expect(check).toEqual({ ok: true });
  });

  it("G2: non-final pages are filled until the next block does not fit", () => {
    const blocks: TextBlock[] = Array.from({ length: 10 }, (_, i) => ({
      style: "paragraph" as const,
      text: `bloque ${i}`,
    }));
    const heights = blocks.map(() => 40);
    const options = { leftHeightPx: 100, rightHeightPx: 100 };
    const pages = packBlocksWithMeasuredHeights(blocks, heights, options);

    expect(pages.length).toBeGreaterThan(1);
    for (let p = 0; p < pages.length - 1; p++) {
      const count = pages[p].blocks?.length ?? 0;
      // 40+40=80 fits; 40*3=120 does not → exactly 2 blocks per full page.
      expect(count).toBe(2);
      expect(count * 40).toBeGreaterThan(100 * 0.65);
    }

    const check = assertPackedPageQuality(pages, heights, options, {
      maxSlackRatio: 0.35,
    });
    expect(check).toEqual({ ok: true });
  });

  it("G1: oversized block alone on a page does not pull the next block onto it", () => {
    const blocks: TextBlock[] = [
      { style: "paragraph", text: "alto" },
      { style: "paragraph", text: "siguiente" },
    ];
    const pages = packBlocksWithMeasuredHeights(blocks, [120, 40], {
      leftHeightPx: 100,
      rightHeightPx: 100,
    });
    expect(pages[0].blocks?.map((b) => b.text)).toEqual(["alto"]);
    expect(pages[1].blocks?.map((b) => b.text)).toEqual(["siguiente"]);
  });
});

describe("G3 Introducción prose fixture", () => {
  it("keeps Introducción as heading/title and merges body into left paragraphs", () => {
    // Y increases downward (same convention as other layout tests).
    const items: PositionedTextItem[] = [
      centeredLine(100, "Introducción", 14),
      leftLine(
        140,
        "El texto sánscrito del Buddha-carita se publicó a principios del"
      ),
      leftLine(156, "año pasado en la Anecdota Oxoniensia."),
      leftLine(190, "Fue editado por Cowell con notas al margen."),
    ];

    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);

    expect(blocks[0].text).toBe("Introducción");
    expect(["heading", "title"]).toContain(blocks[0].style);
    expect(blocks[0].align).toBe("center");

    const prose = blocks.filter((b) => b.style === "paragraph");
    expect(prose.length).toBeGreaterThanOrEqual(1);
    expect(prose.every((b) => b.align === "left")).toBe(true);
    expect(prose[0].text).toContain("principios del año pasado");
    expect(prose.some((b) => b.text.includes("Cowell"))).toBe(true);
  });
});
