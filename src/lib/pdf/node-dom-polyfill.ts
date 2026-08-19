import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

type CanvasDom = {
  DOMMatrix?: typeof globalThis.DOMMatrix;
  ImageData?: typeof globalThis.ImageData;
  Path2D?: typeof globalThis.Path2D;
};

type PdfjsWorkerModule = {
  WorkerMessageHandler: unknown;
};

type GlobalWithPdfjsWorker = typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler?: unknown };
};

let ensured = false;

function importFileUrl<T>(fileUrl: string): Promise<T> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)"
  ) as (specifier: string) => Promise<T>;
  return dynamicImport(fileUrl);
}

function polyfillCanvasDom(): void {
  if (typeof globalThis.DOMMatrix === "function") return;

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
}

/**
 * pdfjs Node disables real Workers and does `import(workerSrc)`. Vercel NFT
 * often copies `pdf.mjs` but not `pdf.worker.mjs`, so the default
 * `./pdf.worker.mjs` throws. Loading the worker ourselves onto
 * `globalThis.pdfjsWorker` makes fake-worker setup skip that import.
 */
async function preloadPdfjsWorker(): Promise<void> {
  const g = globalThis as GlobalWithPdfjsWorker;
  if (g.pdfjsWorker?.WorkerMessageHandler) return;

  const require = createRequire(import.meta.url);
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const worker = await importFileUrl<PdfjsWorkerModule>(
    pathToFileURL(workerPath).href
  );
  g.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
}

/**
 * pdfjs-dist evaluates `new DOMMatrix()` at module load. In Next/Turbopack its
 * own polyfill (`process.getBuiltinModule("module").createRequire`) fails, so
 * we install @napi-rs/canvas globals first, then the fake-worker handler.
 */
export async function ensurePdfNodeDom(): Promise<void> {
  if (ensured) return;
  polyfillCanvasDom();
  await preloadPdfjsWorker();
  ensured = true;
}
