import { describe, expect, it } from "vitest";
import { toTransferablePdfBytes } from "./extract-positioned";

describe("toTransferablePdfBytes", () => {
  it("returns a standalone Uint8Array that owns its buffer", () => {
    const buf = Buffer.from([1, 2, 3, 4, 5]);
    const bytes = toTransferablePdfBytes(buf);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
    // Must own a dedicated ArrayBuffer (not a pooled Node Buffer view).
    expect(bytes.byteOffset).toBe(0);
    expect(bytes.byteLength).toBe(bytes.buffer.byteLength);
  });
});
