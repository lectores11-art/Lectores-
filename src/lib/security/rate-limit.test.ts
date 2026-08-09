import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "./rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to limit within the window", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window", () => {
    vi.useFakeTimers();
    const key = `test-window-${Math.random()}`;
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
    expect(rateLimit(key, 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
  });
});

describe("clientIpFromRequest", () => {
  it("uses first x-forwarded-for hop", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIpFromRequest(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(
      clientIpFromRequest(
        new Request("http://localhost", { headers: { "x-real-ip": "9.9.9.9" } })
      )
    ).toBe("9.9.9.9");
    expect(clientIpFromRequest(new Request("http://localhost"))).toBe("unknown");
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After", async () => {
    const res = rateLimitResponse(12);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    const body = await res.json();
    expect(body.error).toMatch(/Demasiados intentos/);
  });
});
