import { describe, expect, it } from "vitest";
import { inferLayoutBlocks } from "./layout-inference";
import type { PositionedTextItem } from "./extract-positioned";

const PAGE_WIDTH = 600;

function centeredLine(y: number, text: string, pageIndex = 0): PositionedTextItem[] {
  const width = text.length * 8;
  const x = (PAGE_WIDTH - width) / 2;
  return [
    {
      text,
      x,
      y,
      width,
      height: 12,
      pageIndex,
      fontSize: 12,
    },
  ];
}

describe("inferLayoutBlocks", () => {
  it("produces 14 centered blocks for a 14-line centered TOC", () => {
    const lines = [
      "Tabla de Contenido",
      "BUDDHACARITA",
      ...Array.from({ length: 12 }, (_, i) => `Libro ${i + 1}: capítulo`),
    ];

    const items: PositionedTextItem[] = lines.flatMap((line, index) =>
      centeredLine(700 - index * 20, line)
    );

    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);
    expect(blocks).toHaveLength(14);
    expect(blocks.every((b) => b.align === "center")).toBe(true);
  });

  it("groups items on the same Y into one line", () => {
    const items: PositionedTextItem[] = [
      { text: "Hello ", x: 50, y: 100, width: 40, height: 12, pageIndex: 0, fontSize: 12 },
      { text: "World", x: 90, y: 101, width: 40, height: 12, pageIndex: 0, fontSize: 12 },
    ];

    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Hello World");
  });

  it("classifies Libro N: as list-item", () => {
    const items = centeredLine(500, "Libro 3: ejemplo");
    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);
    expect(blocks[0].style).toBe("list-item");
  });

  it("infers title/subtitle from relative font size when centered", () => {
    const items: PositionedTextItem[] = [
      { text: "Título grande", x: 200, y: 100, width: 200, height: 20, pageIndex: 0, fontSize: 20 },
      { text: "Subtítulo", x: 220, y: 130, width: 160, height: 14, pageIndex: 0, fontSize: 14 },
      { text: "Cuerpo normal del texto.", x: 50, y: 160, width: 400, height: 11, pageIndex: 0, fontSize: 11 },
    ];

    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);
    expect(blocks[0].style).toBe("title");
    expect(blocks[1].style).toBe("subtitle");
    expect(blocks[2].style).toBe("paragraph");
    expect(blocks[2].align).toBe("left");
  });

  it("merges wrapped prose lines into one justified paragraph", () => {
    const items: PositionedTextItem[] = [
      {
        text: "El texto sánscrito del Buddha-carita se publicó a principios del",
        x: 72,
        y: 200,
        width: 420,
        height: 11,
        pageIndex: 0,
        fontSize: 11,
      },
      {
        text: "año pasado en la Anecdota Oxoniensia.",
        x: 72,
        y: 216,
        width: 280,
        height: 11,
        pageIndex: 0,
        fontSize: 11,
      },
      {
        text: "Fue editado por Cowell.",
        x: 72,
        y: 248,
        width: 200,
        height: 11,
        pageIndex: 0,
        fontSize: 11,
      },
    ];

    const blocks = inferLayoutBlocks(items, PAGE_WIDTH);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].style).toBe("paragraph");
    expect(blocks[0].align).toBe("left");
    expect(blocks[0].text).toContain("principios del año pasado");
    expect(blocks[1].text).toBe("Fue editado por Cowell.");
  });
});
