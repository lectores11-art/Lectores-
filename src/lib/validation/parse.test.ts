import { describe, expect, it } from "vitest";
import { VALIDATION_ERROR_MESSAGE } from "./errors";
import { parseData, parseJsonBody, validatePdfFile } from "./parse";
import { inviteJoinSchema, slugParamsSchema } from "./schemas";

describe("parseData", () => {
  it("returns parsed data on success", () => {
    const result = parseData(slugParamsSchema, { slug: "demo" });
    expect(result).toEqual({ data: { slug: "demo" } });
  });

  it("returns a 400 NextResponse on failure", async () => {
    const result = parseData(slugParamsSchema, { slug: "" });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.status).toBe(400);
    await expect(result.error.json()).resolves.toEqual({
      error: VALIDATION_ERROR_MESSAGE,
    });
  });
});

describe("parseJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invite-token" }),
    });
    const result = await parseJsonBody(request, inviteJoinSchema);
    expect(result).toEqual({ data: { token: "invite-token" } });
  });

  it("returns validation error for invalid JSON", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const result = await parseJsonBody(request, inviteJoinSchema);
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.status).toBe(400);
  });

  it("returns validation error for schema mismatch", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "" }),
    });
    const result = await parseJsonBody(request, inviteJoinSchema);
    expect("error" in result).toBe(true);
  });
});

describe("validatePdfFile", () => {
  it("accepts a normal PDF file", () => {
    const file = new File(["%PDF-1.4"], "book.pdf", {
      type: "application/pdf",
    });
    expect(validatePdfFile(file)).toBeNull();
  });

  it("rejects missing or non-pdf files", () => {
    expect(validatePdfFile(null)?.status).toBe(400);
    const txt = new File(["hola"], "notes.txt", { type: "text/plain" });
    expect(validatePdfFile(txt)?.status).toBe(400);
  });

  it("accepts octet-stream PDFs by extension", () => {
    const file = new File(["%PDF"], "libro.pdf", {
      type: "application/octet-stream",
    });
    expect(validatePdfFile(file)).toBeNull();
  });
});
