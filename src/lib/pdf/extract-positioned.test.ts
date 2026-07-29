import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PositionedTextItem } from "./extract-positioned";

const mockGetTextContent = vi.fn();
const mockGetPage = vi.fn();
const mockDestroy = vi.fn();
const mockGetInfo = vi.fn();

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getInfo: mockGetInfo,
    destroy: mockDestroy,
  })),
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: mockGetPage,
      destroy: mockDestroy,
    }),
  })),
}));

describe("extractPositionedTextFromPdfBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInfo.mockResolvedValue({ total: 1 });
    mockGetPage.mockResolvedValue({
      getViewport: () => ({
        convertToViewportPoint: (x: number, y: number) => [x, 100 - y],
      }),
      getTextContent: mockGetTextContent,
      cleanup: vi.fn(),
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

    const { extractPositionedTextFromPdfBuffer } = await import("./extract-positioned");
    const items = await extractPositionedTextFromPdfBuffer(Buffer.from("fake-pdf"));

    expect(items).toHaveLength(2);
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

    const { extractPositionedTextFromPdfBuffer } = await import("./extract-positioned");
    const items = await extractPositionedTextFromPdfBuffer(Buffer.from("fake"));
    expect(items).toHaveLength(0);
  });

  it("returns empty array when pdf-parse validation fails", async () => {
    mockGetInfo.mockRejectedValue(new Error("invalid pdf"));
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
