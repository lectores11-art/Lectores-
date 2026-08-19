import { createRequire } from "node:module";

type CanvasDom = {
  DOMMatrix?: typeof globalThis.DOMMatrix;
  ImageData?: typeof globalThis.ImageData;
  Path2D?: typeof globalThis.Path2D;
};

let ensured = false;

/**
 * pdfjs-dist evaluates `new DOMMatrix()` at module load. In Next/Turbopack its
 * own polyfill (`process.getBuiltinModule("module").createRequire`) fails, so
 * we install @napi-rs/canvas globals first.
 */
export async function ensurePdfNodeDom(): Promise<void> {
  if (ensured) return;
  if (typeof globalThis.DOMMatrix === "function") {
    ensured = true;
    return;
  }

  const require = createRequire(import.meta.url);
  const canvas = require("@napi-rs/canvas") as CanvasDom;

  if (canvas.DOMMatrix && typeof globalThis.DOMMatrix !== "function") {
    globalThis.DOMMatrix = canvas.DOMMatrix;
  }
  if (canvas.ImageData && typeof globalThis.ImageData !== "function") {
    globalThis.ImageData = canvas.ImageData;
  }
  if (canvas.Path2D && typeof globalThis.Path2D !== "function") {
    globalThis.Path2D = canvas.Path2D;
  }

  if (!globalThis.navigator?.language) {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US", platform: "", userAgent: "" },
      configurable: true,
    });
  }

  if (typeof globalThis.DOMMatrix !== "function") {
    throw new Error(
      "PDF canvas polyfill failed: DOMMatrix is not available. Install @napi-rs/canvas."
    );
  }

  ensured = true;
}
