import { describe, expect, it } from "vitest";
import { dayKeyInZone, wallTimeToUtc } from "./timezone";
import { formatEventTime, formatEventWhen } from "./format";

describe("wallTimeToUtc", () => {
  it("treats 3pm Buenos Aires as 18:00 UTC", () => {
    const date = wallTimeToUtc("2026-08-23T15:00", "America/Argentina/Buenos_Aires");
    expect(date?.toISOString()).toBe("2026-08-23T18:00:00.000Z");
  });

  it("treats 3pm Mexico City as 21:00 UTC", () => {
    const date = wallTimeToUtc("2026-08-23T15:00", "America/Mexico_City");
    expect(date?.toISOString()).toBe("2026-08-23T21:00:00.000Z");
  });

  it("treats 3pm Madrid in summer as 13:00 UTC", () => {
    const date = wallTimeToUtc("2026-08-23T15:00", "Europe/Madrid");
    expect(date?.toISOString()).toBe("2026-08-23T13:00:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(wallTimeToUtc("nope", "UTC")).toBeNull();
    expect(wallTimeToUtc("2026-08-23T15:00", "Not/AZone")).toBeNull();
  });
});

describe("dayKeyInZone", () => {
  it("can place a UTC instant on the previous local day", () => {
    const instant = new Date("2026-08-24T02:00:00.000Z");
    expect(dayKeyInZone(instant, "America/Argentina/Buenos_Aires")).toBe(
      "2026-08-23"
    );
    expect(dayKeyInZone(instant, "UTC")).toBe("2026-08-24");
  });
});

describe("display in viewer timezone", () => {
  const instant = new Date("2026-08-23T18:00:00.000Z");

  it("shows 3pm in Buenos Aires and 12pm in Mexico City", () => {
    expect(formatEventTime(instant, "America/Argentina/Buenos_Aires")).toBe("3pm");
    expect(formatEventTime(instant, "America/Mexico_City")).toBe("12pm");
  });

  it("keeps the weekday in the viewer zone", () => {
    expect(
      formatEventWhen(instant, new Date("2026-08-23T19:00:00.000Z"), "America/Argentina/Buenos_Aires")
    ).toBe("domingo, agosto 23° @ 3pm - 4pm");
  });
});
