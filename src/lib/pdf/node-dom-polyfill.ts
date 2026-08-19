type CanvasDom = {
  DOMMatrix?: typeof globalThis.DOMMatrix;
  ImageData?: typeof globalThis.ImageData;
  Path2D?: typeof globalThis.Path2D;
};

type GlobalWithPdfjsWorker = typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler?: unknown };
};

let ensured = false;

function installCanvasDom(canvas: CanvasDom): void {
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
 * pdfjs-dist evaluates `new DOMMatrix()` at module load. Next/Turbopack also
 * rewrites module URLs to numeric ids, so we never resolve filesystem paths —
 * only package specifiers already in serverExternalPackages.
 */
async function polyfillCanvasDom(): Promise<void> {
  if (typeof globalThis.DOMMatrix === "function") return;
  const canvasMod = await import("@napi-rs/canvas");
  installCanvasDom({
    DOMMatrix: canvasMod.DOMMatrix as unknown as typeof globalThis.DOMMatrix,
    ImageData: canvasMod.ImageData as unknown as typeof globalThis.ImageData,
    Path2D: canvasMod.Path2D as unknown as typeof globalThis.Path2D,
  });
}

/**
 * pdfjs Node disables real Workers and does `import(workerSrc)`. Loading the
 * worker onto `globalThis.pdfjsWorker` makes fake-worker setup skip that import.
 */
async function preloadPdfjsWorker(): Promise<void> {
  const g = globalThis as GlobalWithPdfjsWorker;
  if (g.pdfjsWorker?.WorkerMessageHandler) return;
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  g.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
}

export async function ensurePdfNodeDom(): Promise<void> {
  if (ensured) return;
  await polyfillCanvasDom();
  await preloadPdfjsWorker();
  ensured = true;
}
