import { describe, expect, it } from "vitest";
import {
  extractTOC,
  hasLegacyPaginationBug,
  normalizeExtractedText,
  paginateText,
  READER_WORDS_PER_PAGE,
} from "./paginator";

describe("paginateText", () => {
  it("does not repeat progressive phrase prefixes on one page", () => {
    const pages = paginateText("Buddhacarita La Vida de Buda");
    expect(pages).toHaveLength(1);
    expect(pages[0].content).toBe("Buddhacarita La Vida de Buda");
    expect(pages[0].content).not.toContain("Buddhacarita\n\nBuddhacarita La");
  });

  it("keeps short multi-word text in a single paragraph", () => {
    const pages = paginateText("one two three four");
    expect(pages[0].content).toBe("one two three four");
    expect(pages[0].content.split("\n\n")).toHaveLength(1);
  });

  it("splits long paragraphs across pages without repeating prior text", () => {
    const words = Array.from({ length: READER_WORDS_PER_PAGE + 40 }, (_, i) => `w${i}`);
    const text = words.join(" ");
    const pages = paginateText(text);

    expect(pages.length).toBeGreaterThanOrEqual(2);
    const allText = pages.map((p) => p.content).join(" ");
    const joinedWords = allText.split(/\s+/);
    expect(joinedWords).toHaveLength(words.length);
    expect(joinedWords[0]).toBe("w0");
    expect(joinedWords[joinedWords.length - 1]).toBe(`w${words.length - 1}`);

    for (const page of pages) {
      const blocks = page.content.split("\n\n");
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].startsWith(blocks[i - 1])).toBe(false);
      }
    }
  });

  it("preserves multiple paragraphs separated by blank lines", () => {
    const pages = paginateText("First paragraph here.\n\nSecond paragraph here.");
    expect(pages[0].content).toContain("First paragraph here.");
    expect(pages[0].content).toContain("Second paragraph here.");
    expect(pages[0].content.split("\n\n")).toHaveLength(2);
  });

  it("handles TOC-style single lines without progressive duplication", () => {
    const tocLine =
      "Tabla de Contenido BUDDHACARITA Libro 1: bhagavat Libro 2: antaḥ Libro 3: saṃveg";
    const pages = paginateText(tocLine);
    expect(pages[0].content).toBe(tocLine);
    expect(hasLegacyPaginationBug(pages)).toBe(false);
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
  it("finds chapter headings in paginated content", () => {
    const pages = paginateText("Capítulo 1\n\nSome body text.");
    const toc = extractTOC(pages);
    expect(toc.some((item) => item.title.includes("Capítulo 1"))).toBe(true);
  });
});

describe("hasLegacyPaginationBug", () => {
  it("detects progressive prefix repetition", () => {
    const legacy = [
      {
        pageNumber: 0,
        content: "Buddhacarita\n\nBuddhacarita La\n\nBuddhacarita La Vida",
      },
    ];
    expect(hasLegacyPaginationBug(legacy)).toBe(true);
  });

  it("returns false for clean pagination", () => {
    const clean = paginateText("Intro paragraph.\n\nNext paragraph.");
    expect(hasLegacyPaginationBug(clean)).toBe(false);
  });
});
