declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(src: { data: Uint8Array }): {
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
}
