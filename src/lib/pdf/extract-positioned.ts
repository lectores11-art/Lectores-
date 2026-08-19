import { ensurePdfNodeDom } from "./node-dom-polyfill";

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

/**
 * Node `Buffer` often views a pooled ArrayBuffer. pdfjs transfers `data.buffer`
 * to its worker via structuredClone; pooled buffers throw DataCloneError
 * ("Cannot transfer object of unsupported type") and break upload on Vercel.
 */
export function toTransferablePdfBytes(buffer: Buffer): Uint8Array {
  return Uint8Array.from(buffer);
}

async function loadPdfJs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export type PositionedExtractResult = {
  items: PositionedTextItem[];
  /** MediaBox width from pdfjs viewport (not content bbox). */
  pageWidth: number;
};

/**
 * Extract text runs with X/Y positions from a PDF buffer using pdfjs.
 * Server-only — used by layout inference during upload (Nivel B).
 */
export async function extractPositionedTextFromPdfBuffer(
  buffer: Buffer
): Promise<PositionedExtractResult> {
  await ensurePdfNodeDom();
  const pdfjs = await loadPdfJs();

  const data = toTransferablePdfBytes(buffer);
  const items: PositionedTextItem[] = [];
  let pageWidth = 612;

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    useWasm: false,
  }).promise;

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      pageWidth = Math.max(pageWidth, viewport.width);
      const textContent = await page.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false,
      });

      for (const raw of textContent.items) {
        const item = raw as TextContentItem;
        if (!item.str?.trim()) continue;

        const tm = item.transform ?? [1, 0, 0, 1, 0, 0];
        const point = viewport.convertToViewportPoint(tm[4], tm[5]);
        const x = Number(point[0]);
        const y = Number(point[1]);
        const fontSize =
          item.height > 0 ? item.height : Math.abs(tm[0]) || undefined;

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

  return { items, pageWidth };
}
