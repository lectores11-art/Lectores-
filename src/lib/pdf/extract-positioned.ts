import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  fontSize?: number;
}

type TextContentItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

type PdfJsModule = {
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage(pageNum: number): Promise<{
        getViewport(params: { scale: number }): {
          convertToViewportPoint(x: number, y: number): [number, number];
        };
        getTextContent(params: {
          includeMarkedContent: boolean;
          disableNormalization: boolean;
        }): Promise<{ items: unknown[] }>;
        cleanup(): void;
      }>;
      destroy(): Promise<void>;
    }>;
  };
};

/**
 * Load pdfjs without a static import path — Turbopack cannot resolve the
 * legacy .mjs subpath when analyzing the module graph.
 */
async function loadPdfJs(): Promise<PdfJsModule> {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const href = pathToFileURL(resolved).href;
  // Hide from bundler static analysis (Turbopack / webpack).
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)"
  ) as (specifier: string) => Promise<PdfJsModule>;
  return dynamicImport(href);
}

/**
 * Extract text runs with X/Y positions from a PDF buffer using pdf-parse/pdfjs.
 * Server-only — used by layout inference during upload.
 */
export async function extractPositionedTextFromPdfBuffer(
  buffer: Buffer
): Promise<PositionedTextItem[]> {
  const { PDFParse } = await import("pdf-parse");
  const pdfjs = await loadPdfJs();

  const data = new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  const items: PositionedTextItem[] = [];

  try {
    await parser.getInfo();

    const doc = await pdfjs.getDocument({ data }).promise;

    try {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });

        for (const raw of textContent.items) {
          const item = raw as TextContentItem;
          if (!item.str?.trim()) continue;

          const tm = item.transform ?? [1, 0, 0, 1, 0, 0];
          const [x, y] = viewport.convertToViewportPoint(tm[4], tm[5]);
          const fontSize = item.height > 0 ? item.height : Math.abs(tm[0]) || undefined;

          items.push({
            text: item.str,
            x,
            y,
            width: item.width ?? 0,
            height: item.height ?? 0,
            pageIndex: pageNum - 1,
            fontSize,
          });
        }

        page.cleanup();
      }
    } finally {
      await doc.destroy();
    }
  } finally {
    await parser.destroy();
  }

  return items;
}
