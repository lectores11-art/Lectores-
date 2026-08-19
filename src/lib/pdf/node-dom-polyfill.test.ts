import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * pdfjs-dist polyfills DOMMatrix via process.getBuiltinModule("module").createRequire.
 * Next/Turbopack wraps pdf-parse so that path throws; Node then hits
 * `const SCALE_MATRIX = new DOMMatrix()` at module load.
 */
const BREAK_BUILTIN = `
process.getBuiltinModule = () => {
  throw new Error("simulated Next/Turbopack");
};
`;

async function runNode(code: string) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", code],
    {
      cwd: ROOT,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    }
  );
  return { stdout, stderr };
}

describe("pdf-parse under Next-like Node (createRequire unavailable)", () => {
  it("fails with DOMMatrix is not defined without a polyfill", async () => {
    const { stdout } = await runNode(`
      ${BREAK_BUILTIN}
      try {
        await import("pdf-parse");
        console.log("LOADED");
      } catch (e) {
        console.log(String(e.message));
      }
    `);
    expect(stdout).toMatch(/DOMMatrix is not defined/);
  });

  it("loads after ensurePdfNodeDom", async () => {
    const polyfillUrl = new URL("./node-dom-polyfill.ts", import.meta.url).href;
    const { stdout } = await runNode(`
      ${BREAK_BUILTIN}
      const { ensurePdfNodeDom } = await import(${JSON.stringify(polyfillUrl)});
      await ensurePdfNodeDom();
      const { PDFParse } = await import("pdf-parse");
      console.log(typeof PDFParse);
    `);
    expect(stdout.trim()).toBe("function");
  });
});
