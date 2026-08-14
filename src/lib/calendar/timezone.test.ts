import { describe, expect, it } from "vitest";
import { dayKeyInZone, HUB_ZONES, wallTimeToUtc } from "./timezone";
import { formatEventTime, formatHubTimes } from "./format";

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

describe("hub display", () => {
  it("lists España, Argentina and México for the same instant", () => {
    expect(HUB_ZONES.map((hub) => hub.label)).toEqual([
      "España",
      "Argentina",
      "México",
    ]);

    const hubs = formatHubTimes(new Date("2026-08-23T18:00:00.000Z"));
    expect(hubs).toEqual([
      { id: "Europe/Madrid", label: "España", short: "ES", time: "8pm" },
      {
        id: "America/Argentina/Buenos_Aires",
        label: "Argentina",
        short: "AR",
        time: "3pm",
      },
      { id: "America/Mexico_City", label: "México", short: "MX", time: "12pm" },
    ]);
  });

  it("keeps formatEventTime aligned with each hub", () => {
    const instant = new Date("2026-08-23T18:00:00.000Z");
    expect(formatEventTime(instant, "Europe/Madrid")).toBe("8pm");
    expect(formatEventTime(instant, "America/Argentina/Buenos_Aires")).toBe("3pm");
    expect(formatEventTime(instant, "America/Mexico_City")).toBe("12pm");
  });
});
