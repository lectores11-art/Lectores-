import { describe, expect, it } from "vitest";
import { getAppUrl } from "./app-url";

describe("getAppUrl", () => {
  const original = { ...process.env };

  function restore() {
    process.env = { ...original };
  }

  it("prefers NEXT_PUBLIC_APP_URL without a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hilo.example/";
    expect(getAppUrl()).toBe("https://hilo.example");
    restore();
  });

  it("falls back to Vercel production URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "lectores-fawn.vercel.app";
    expect(getAppUrl()).toBe("https://lectores-fawn.vercel.app");
    restore();
  });
});
