import { describe, expect, it } from "vitest";
import {
  assertWordPreservation,
  buildBlocks,
  classifyLineStyle,
  extractTOC,
  hasLegacyPaginationBug,
  LEFT_PAGE_WORDS,
  normalizeExtractedText,
  paginateText,
  RIGHT_PAGE_WORDS,
} from "./paginator";

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
