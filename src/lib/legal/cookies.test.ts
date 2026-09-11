import { describe, expect, it } from "vitest";
import { isEmbedAllowed, parseCookieConsent } from "./cookies";

describe("parseCookieConsent", () => {
  it("parses a decided embeds choice", () => {
    const raw = JSON.stringify({
      necessary: true,
      embeds: true,
      decidedAt: "2026-09-09T12:00:00.000Z",
    });
    expect(parseCookieConsent(raw)).toEqual({
      necessary: true,
      embeds: true,
      decidedAt: "2026-09-09T12:00:00.000Z",
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseCookieConsent(null)).toBeNull();
    expect(parseCookieConsent("{")).toBeNull();
    expect(parseCookieConsent(JSON.stringify({ embeds: true }))).toBeNull();
  });
});

describe("isEmbedAllowed", () => {
  it("only allows third-party embeds after explicit yes", () => {
    expect(isEmbedAllowed(null)).toBe(false);
    expect(
      isEmbedAllowed({
        necessary: true,
        embeds: false,
        decidedAt: "2026-09-09T12:00:00.000Z",
      })
    ).toBe(false);
    expect(
      isEmbedAllowed({
        necessary: true,
        embeds: true,
        decidedAt: "2026-09-09T12:00:00.000Z",
      })
    ).toBe(true);
  });
});
