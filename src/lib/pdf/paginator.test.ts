import { describe, expect, it } from "vitest";
import {
  assertWordPreservation,
  blockLineCost,
  buildBlocks,
  classifyLineStyle,
  extractTOC,
  flattenPageBlocks,
  hasLegacyPaginationBug,
  isParagraphContinuation,
  LEFT_PAGE_LINES,
  LEFT_PAGE_WORDS,
  mergeContinuationParagraphs,
  normalizeExtractedText,
  packBlocksWithMeasuredHeights,
  paginateBlocksByHeight,
  paginateBlocksByLines,
  paginateText,
  RIGHT_PAGE_LINES,
  RIGHT_PAGE_WORDS,
} from "./paginator";

describe("paginateBlocksByLines", () => {
  it("spreads a long TOC across multiple pages with all blocks preserved", () => {
    const lines = [
      "Tabla de Contenido",
      "BUDDHACARITA",
      ...Array.from({ length: 30 }, (_, i) => `Libro ${i + 1}: capítulo`),
    ];
    const blocks = lines.map((text) => ({
      style: classifyLineStyle(text),
      text,
      align: "center" as const,
    }));

    const pages = paginateBlocksByLines(blocks);
    const recovered = pages.flatMap((p) => p.blocks ?? []);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(recovered).toHaveLength(lines.length);
    expect(recovered.map((b) => b.text)).toEqual(lines);
  });

  it("never splits list-item blocks across pages", () => {
    const item = { style: "list-item" as const, text: "Libro 5: ejemplo largo de capítulo" };
    const fillers = Array.from({ length: 40 }, (_, i) => ({
      style: "paragraph" as const,
      text: `filler line ${i}`,
    }));
    const pages = paginateBlocksByLines([...fillers, item]);

    const listPages = pages.filter((p) =>
      (p.blocks ?? []).some((b) => b.style === "list-item")
    );
    expect(listPages).toHaveLength(1);
    expect(listPages[0].blocks?.some((b) => b.text === item.text)).toBe(true);
  });

  it("uses alternating left/right capacity (left tighter than right)", () => {
    expect(blockLineCost({ style: "paragraph", text: "x" })).toBeGreaterThanOrEqual(1);
    const blocks = Array.from({ length: 40 }, (_, i) => ({
      style: "paragraph" as const,
      text: `Párrafo de relleno número ${i} con varias palabras para ocupar altura vertical en la página.`,
    }));
    const pages = paginateBlocksByHeight(blocks, {
      leftHeightPx: 200,
      rightHeightPx: 260,
      fontSize: 17,
    });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const leftCount = pages[0].blocks?.length ?? 0;
    const rightCount = pages[1].blocks?.length ?? 0;
    expect(leftCount).toBeGreaterThan(0);
    expect(rightCount).toBeGreaterThan(0);
    expect(leftCount).toBeLessThanOrEqual(rightCount + 1);
  });
});

describe("mergeContinuationParagraphs", () => {
  it("rejoins mid-sentence paragraph fragments from legacy page splits", () => {
    const blocks = [
      { style: "paragraph" as const, text: "a principios del" },
      { style: "paragraph" as const, text: "año pasado en la Anecdota" },
      { style: "paragraph" as const, text: "Oxoniensia." },
    ];
    expect(isParagraphContinuation("a principios del", "año pasado")).toBe(true);
    const merged = mergeContinuationParagraphs(blocks);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("a principios del año pasado en la Anecdota Oxoniensia.");
  });

  it("does not merge a new sentence that starts with uppercase", () => {
    const merged = mergeContinuationParagraphs([
      { style: "paragraph", text: "Fin de la introducción." },
      { style: "paragraph", text: "El siguiente capítulo empieza aquí." },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("flattenPageBlocks merges split paragraphs across stored pages", () => {
    const pages = [
      { pageNumber: 0, content: "Hiouen Thsang, que salió", blocks: [{ style: "paragraph" as const, text: "Hiouen Thsang, que salió" }] },
      { pageNumber: 1, content: "de la India en el año 645.", blocks: [{ style: "paragraph" as const, text: "de la India en el año 645." }] },
    ];
    const flat = flattenPageBlocks(pages);
    expect(flat).toHaveLength(1);
    expect(flat[0].text).toContain("salió de la India");
  });
});

describe("packBlocksWithMeasuredHeights", () => {
  it("keeps sequential content across pages without dropping blocks", () => {
    const blocks = Array.from({ length: 8 }, (_, i) => ({
      style: "paragraph" as const,
      text: `bloque ${i}`,
    }));
    const heights = blocks.map(() => 40);
    const pages = packBlocksWithMeasuredHeights(blocks, heights, {
      leftHeightPx: 100,
      rightHeightPx: 100,
    });
    expect(pages.length).toBe(4);
    expect(pages.flatMap((p) => (p.blocks ?? []).map((b) => b.text))).toEqual(
      blocks.map((b) => b.text)
    );
    // Page 2 must continue page 1 (no skip).
    expect(pages[0].blocks?.map((b) => b.text)).toEqual(["bloque 0", "bloque 1"]);
    expect(pages[1].blocks?.map((b) => b.text)).toEqual(["bloque 2", "bloque 3"]);
  });

  it("moves a block that does not fit to the next page (no clip)", () => {
    const blocks = [
      { style: "paragraph" as const, text: "corto" },
      { style: "paragraph" as const, text: "largo" },
    ];
    const pages = packBlocksWithMeasuredHeights(blocks, [40, 80], {
      leftHeightPx: 100,
      rightHeightPx: 100,
    });
    expect(pages[0].blocks?.map((b) => b.text)).toEqual(["corto"]);
    expect(pages[1].blocks?.map((b) => b.text)).toEqual(["largo"]);
  });
});

describe("paginateBlocksByHeight", () => {
  it("fits blocks into the measured page height without dropping content", () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({
      style: "list-item" as const,
      text: `Libro ${i + 1}: título`,
    }));
    const pages = paginateBlocksByHeight(blocks, {
      leftHeightPx: 280,
      rightHeightPx: 320,
      fontSize: 17,
    });
    expect(pages.length).toBeGreaterThan(1);
    expect(flattenPageBlocks(pages).map((b) => b.text)).toEqual(blocks.map((b) => b.text));
  });

  it("fills a typical reader page with several medium paragraphs (not half-blank)", () => {
    const para =
      "El texto sánscrito del Buddha-carita se publicó a principios del año pasado en la Anecdota Oxoniensia, y ahora presentamos la traducción inglesa del poema.";
    const blocks = Array.from({ length: 6 }, () => ({
      style: "paragraph" as const,
      text: para,
    }));
    const pages = paginateBlocksByHeight(blocks, {
      leftHeightPx: 500,
      rightHeightPx: 520,
      fontSize: 17,
    });
    expect((pages[0].blocks ?? []).length).toBeGreaterThanOrEqual(3);
    expect(flattenPageBlocks(pages)).toHaveLength(6);
  });

  it("marks cross-page paragraph splits as continued (no false new-paragraph indent)", () => {
    const long =
      "El texto sánscrito del Buddha-carita se publicó a principios del año pasado en la Anecdota Oxoniensia y la siguiente traducción al inglés ahora se incluye en la serie de libros sagrados del oriente con notas del editor.";
    const pages = paginateBlocksByHeight([{ style: "paragraph", text: long }], {
      leftHeightPx: 90,
      rightHeightPx: 90,
      fontSize: 17,
    });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].blocks?.[0]?.continued).toBeFalsy();
    expect(pages[1].blocks?.[0]?.continued).toBe(true);
    expect(flattenPageBlocks(pages).map((b) => b.text).join(" ")).toContain("Buddha-carita");
  });
});

describe("classifyLineStyle", () => {
  it("detects TOC title and list items", () => {
    expect(classifyLineStyle("Tabla de Contenido")).toBe("title");
    expect(classifyLineStyle("BUDDHACARITA")).toBe("subtitle");
    expect(classifyLineStyle("Libro 1: bhagavat prasūtiḥ")).toBe("list-item");
    expect(classifyLineStyle("Introducción")).toBe("title");
  });
});

describe("buildBlocks", () => {
  it("keeps TOC lines separate instead of merging into one paragraph", () => {
    const text = [
      "Tabla de Contenido",
      "BUDDHACARITA",
      "Libro 1: bhagavat prasūtiḥ",
      "Libro 2: antaḥ-pura-vihāraḥ",
    ].join("\n");

    const blocks = buildBlocks(text);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual({ style: "title", text: "Tabla de Contenido" });
    expect(blocks[1]).toEqual({ style: "subtitle", text: "BUDDHACARITA" });
    expect(blocks[2].style).toBe("list-item");
    expect(blocks[3].style).toBe("list-item");
  });

  it("merges wrapped prose lines into one paragraph", () => {
    const text = "El texto sánscrito del Buddha-carita se publicó\na principios del año pasado.";
    const blocks = buildBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].style).toBe("paragraph");
    expect(blocks[0].text).toContain("Buddha-carita");
    expect(blocks[0].text).toContain("a principios");
  });
});

describe("paginateText", () => {
  it("does not repeat progressive phrase prefixes on one page", () => {
    const pages = paginateText("Buddhacarita La Vida de Buda");
    expect(pages).toHaveLength(1);
    expect(pages[0].content).toBe("Buddhacarita La Vida de Buda");
  });

  it("stores structured blocks on each page", () => {
    const text = "Tabla de Contenido\nBUDDHACARITA\nLibro 1: uno\nLibro 2: dos";
    const pages = paginateText(text);
    expect(pages[0].blocks?.[0].style).toBe("title");
    expect(pages[0].blocks?.filter((b) => b.style === "list-item")).toHaveLength(2);
  });

  it("preserves every word in order across page boundaries", () => {
    const words = Array.from({ length: LEFT_PAGE_WORDS + RIGHT_PAGE_WORDS + 50 }, (_, i) => `w${i}`);
    const text = words.join(" ");
    const pages = paginateText(text);

    expect(assertWordPreservation(text, pages)).toBe(true);
    expect(pages[0].content.split(/\s+/).length).toBe(LEFT_PAGE_WORDS);
    expect(pages[1].content.split(/\s+/).length).toBe(RIGHT_PAGE_WORDS);
  });

  it("splits long paragraphs across pages without repeating prior text", () => {
    const words = Array.from({ length: LEFT_PAGE_WORDS + 40 }, (_, i) => `w${i}`);
    const text = words.join(" ");
    const pages = paginateText(text);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(assertWordPreservation(text, pages)).toBe(true);
  });

  it("preserves multiple paragraphs separated by blank lines", () => {
    const pages = paginateText("First paragraph here.\n\nSecond paragraph here.");
    expect(pages[0].content).toContain("First paragraph here.");
    expect(pages[0].content).toContain("Second paragraph here.");
  });

  it("uses alternating left/right word limits", () => {
    const total = LEFT_PAGE_WORDS + RIGHT_PAGE_WORDS + 10;
    const words = Array.from({ length: total }, (_, i) => `x${i}`);
    const pages = paginateText(words.join(" "));
    expect(pages[0].content.split(/\s+/).length).toBe(LEFT_PAGE_WORDS);
    expect(pages[1].content.split(/\s+/).length).toBe(RIGHT_PAGE_WORDS);
    expect(pages[2].content.split(/\s+/).length).toBe(10);
  });
});

describe("normalizeExtractedText", () => {
  it("removes consecutive duplicate lines", () => {
    const input = "Header\nHeader\nBody line";
    expect(normalizeExtractedText(input)).toBe("Header\nBody line");
  });

  it("collapses repeated spaces within a line", () => {
    expect(normalizeExtractedText("too   many    spaces")).toBe("too many spaces");
  });
});

describe("extractTOC", () => {
  it("finds Libro entries from list-item blocks", () => {
    const pages = paginateText("Tabla de Contenido\nLibro 1: bhagavat\nLibro 2: antaḥ");
    const toc = extractTOC(pages);
    expect(toc.some((item) => item.title.includes("Libro 1"))).toBe(true);
    expect(toc.some((item) => item.title.includes("Libro 2"))).toBe(true);
  });
});

describe("hasLegacyPaginationBug", () => {
  it("detects progressive prefix repetition", () => {
    const legacy = [
      {
        pageNumber: 0,
        content: "Buddhacarita\nBuddhacarita La\nBuddhacarita La Vida",
      },
    ];
    expect(hasLegacyPaginationBug(legacy)).toBe(true);
  });

  it("returns false for clean pagination", () => {
    const clean = paginateText("Intro paragraph.\n\nNext paragraph.");
    expect(hasLegacyPaginationBug(clean)).toBe(false);
  });
});
