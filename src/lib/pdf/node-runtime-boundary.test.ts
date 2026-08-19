import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));

function readSrc(name: string) {
  return readFileSync(path.join(dir, name), "utf8");
}

describe("PDF Node runtime must not resolve files via import.meta.url", () => {
  it("node-dom-polyfill uses package specifiers, not createRequire/pathToFileURL", () => {
    const src = readSrc("node-dom-polyfill.ts");
    expect(src).not.toMatch(/createRequire/);
    expect(src).not.toMatch(/pathToFileURL/);
    expect(src).not.toMatch(/import\.meta\.url/);
    expect(src).toMatch(/@napi-rs\/canvas/);
    expect(src).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs/);
  });

  it("extract-positioned loads pdfjs via package specifier, not file://", () => {
    const src = readSrc("extract-positioned.ts");
    expect(src).not.toMatch(/createRequire/);
    expect(src).not.toMatch(/pathToFileURL/);
    expect(src).not.toMatch(/import\.meta\.url/);
    expect(src).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.mjs/);
    expect(src).not.toMatch(/pdf-parse/);
  });
});
