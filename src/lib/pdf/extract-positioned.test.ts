import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PositionedTextItem } from "./extract-positioned";

const mockGetTextContent = vi.fn();
const mockGetPage = vi.fn();
const mockDestroy = vi.fn();
const mockGetDocument = vi.fn();

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock("./node-dom-polyfill", () => ({
  ensurePdfNodeDom: vi.fn().mockResolvedValue(undefined),
}));

describe("extractPositionedTextFromPdfBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPage.mockResolvedValue({
      getViewport: () => ({
        width: 612,
        convertToViewportPoint: (x: number, y: number) => [x, 100 - y],
      }),
      getTextContent: mockGetTextContent,
      cleanup: vi.fn(),
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
        destroy: mockDestroy,
      }),
    });
  });

  it("returns positioned items with text, coordinates, and pageIndex", async () => {
    mockGetTextContent.mockResolvedValue({
      items: [
        {
          str: "Tabla de Contenido",
          transform: [12, 0, 0, 12, 200, 700],
          width: 120,
          height: 12,
        },
        {
          str: "Libro 1:",
          transform: [10, 0, 0, 10, 250, 650],
          width: 50,
          height: 10,
        },
      ],
    });

    vi.resetModules();
    const { extractPositionedTextFromPdfBuffer } = await import("./extract-positioned");
    const { items, pageWidth } = await extractPositionedTextFromPdfBuffer(
      Buffer.from("fake-pdf")
    );

    expect(items).toHaveLength(2);
    expect(pageWidth).toBeGreaterThanOrEqual(612);
    expect(items[0]).toMatchObject({
      text: "Tabla de Contenido",
      pageIndex: 0,
      width: 120,
      height: 12,
      fontSize: 12,
    });
    expect(items[0].x).toBe(200);
    expect(items[1].text).toBe("Libro 1:");
  });

  it("skips empty text runs", async () => {
    mockGetTextContent.mockResolvedValue({
      items: [{ str: "   ", transform: [1, 0, 0, 1, 0, 0], width: 0, height: 0 }],
    });

    vi.resetModules();
    const { extractPositionedTextFromPdfBuffer } = await import("./extract-positioned");
    const { items } = await extractPositionedTextFromPdfBuffer(Buffer.from("fake"));
    expect(items).toHaveLength(0);
  });

  it("rejects when pdfjs cannot open the document", async () => {
    mockGetDocument.mockImplementation(() => ({
      promise: Promise.reject(new Error("invalid pdf")),
    }));
    vi.resetModules();
    const { extractPositionedTextFromPdfBuffer } = await import("./extract-positioned");

    await expect(extractPositionedTextFromPdfBuffer(Buffer.from("bad"))).rejects.toThrow(
      "invalid pdf"
    );
  });
});

describe("PositionedTextItem shape", () => {
  it("matches the expected contract", () => {
    const item: PositionedTextItem = {
      text: "sample",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      pageIndex: 0,
      fontSize: 12,
    };
    expect(item.pageIndex).toBe(0);
  });
});
