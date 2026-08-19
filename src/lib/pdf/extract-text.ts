import { ensurePdfNodeDom } from "./node-dom-polyfill";

/** Fallback text extract (Nivel A) when positioned layout inference fails. */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  await ensurePdfNodeDom();
  const { PDFParse } = await import("pdf-parse");
  // Standalone copy — Node Buffer views can break pdfjs transfer inside pdf-parse on Vercel.
  const data = Uint8Array.from(buffer);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ lineEnforce: true, pageJoiner: "\n" });
    if (result.pages && result.pages.length > 0) {
      return result.pages.map((p) => p.text).join("\n");
    }
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}
