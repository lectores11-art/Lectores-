import { describe, expect, it } from "vitest";
import {
  firstUrl,
  formatEventTime,
  googleCalendarUrl,
  icsContent,
  monthGridDays,
  outlookCalendarUrl,
  resolveEventRange,
  visibleRange,
} from "./format";
import { CALENDAR_DAY_ZONE, dayKeyInZone, utcCivilKey } from "./timezone";

describe("monthGridDays", () => {
  it("returns 42 hub days starting Monday before August 2026", () => {
    const days = monthGridDays(new Date(Date.UTC(2026, 7, 1, 12, 0, 0)));
    expect(days).toHaveLength(42);
    expect(days[0]?.toISOString()).toBe("2026-07-27T12:00:00.000Z");
    expect(days[5]?.toISOString()).toBe("2026-08-01T12:00:00.000Z");
    expect(days[35]?.toISOString()).toBe("2026-08-31T12:00:00.000Z");
    expect(days[41]?.toISOString()).toBe("2026-09-06T12:00:00.000Z");
    expect(utcCivilKey(days[5]!)).toBe("2026-08-01");
    for (const day of days) {
      expect(utcCivilKey(day)).toBe(dayKeyInZone(day, CALENDAR_DAY_ZONE));
    }
  });

  it("pads a 4-week February to 42 days", () => {
    const days = monthGridDays(new Date(Date.UTC(2021, 1, 1, 12, 0, 0)));
    expect(days).toHaveLength(42);
    expect(days[0]?.toISOString()).toBe("2021-02-01T12:00:00.000Z");
    expect(days[27]?.toISOString()).toBe("2021-02-28T12:00:00.000Z");
    expect(days[41]?.toISOString()).toBe("2021-03-14T12:00:00.000Z");
  });
});

describe("visibleRange", () => {
  it("uses Argentina midnight of the first cell and exclusive next midnight after the last", () => {
    const { start, end } = visibleRange(new Date(Date.UTC(2021, 1, 1, 12, 0, 0)));
    expect(start.toISOString()).toBe("2021-02-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2021-03-15T03:00:00.000Z");
  });
});

describe("firstUrl", () => {
  it("extracts the first http(s) url and strips trailing punctuation", () => {
    expect(firstUrl("Join here: https://lectores.example/call.")).toBe(
      "https://lectores.example/call"
    );
  });

  it("returns null when there is no http(s) url", () => {
    expect(firstUrl("ftp://files.example/x")).toBeNull();
    expect(firstUrl("sin enlace")).toBeNull();
  });
});

describe("resolveEventRange", () => {
  it("defaults a missing end to one hour after start", () => {
    const start = new Date(2026, 7, 23, 15, 0);
    const result = resolveEventRange(start, null);
    expect(result).toEqual({
      ok: true,
      startsAt: start,
      endsAt: new Date(2026, 7, 23, 16, 0),
    });
  });

  it("rejects an end that is not after start", () => {
    const start = new Date(2026, 7, 23, 15, 0);
    expect(resolveEventRange(start, start).ok).toBe(false);
    expect(resolveEventRange(start, new Date(2026, 7, 23, 14, 0)).ok).toBe(false);
  });

  it("rejects an invalid start", () => {
    expect(resolveEventRange(new Date("nope"), null).ok).toBe(false);
  });
});

describe("formatEventTime", () => {
  const zone = "America/Argentina/Buenos_Aires";

  it("omits minutes on the hour and lowercases am/pm", () => {
    expect(formatEventTime(new Date("2026-08-23T18:00:00.000Z"), zone)).toBe("3pm");
    expect(formatEventTime(new Date("2026-08-23T12:00:00.000Z"), zone)).toBe("9am");
  });

  it("keeps minutes when not on the hour", () => {
    expect(formatEventTime(new Date("2026-08-23T18:30:00.000Z"), zone)).toBe(
      "3:30pm"
    );
  });
});

describe("calendar export urls", () => {
  const event = {
    uid: "evt-23",
    title: "360 VA Skool Call",
    description: "Weekly call",
    startsAt: new Date("2026-08-23T15:00:00-03:00"),
    endsAt: new Date("2026-08-23T16:00:00-03:00"),
    url: "https://360volleyballskool.com",
  };

  it("builds a Google Calendar template url", () => {
    const href = googleCalendarUrl(event);
    expect(href.startsWith("https://calendar.google.com/calendar/render?")).toBe(
      true
    );
    expect(href).toContain("text=360+VA+Skool+Call");
    expect(href).toContain("dates=20260823T180000Z%2F20260823T190000Z");
  });

  it("builds an Outlook compose url", () => {
    const href = outlookCalendarUrl(event);
    expect(href.startsWith("https://outlook.live.com/calendar/0/action/compose?")).toBe(
      true
    );
    expect(href).toContain("subject=360+VA+Skool+Call");
  });

  it("builds a VCALENDAR body", () => {
    const ics = icsContent(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:360 VA Skool Call");
    expect(ics).toContain("UID:evt-23@lectores");
    expect(ics).toContain("DTSTART:20260823T180000Z");
    expect(ics).toContain("DTEND:20260823T190000Z");
    expect(ics).toContain("URL:https://360volleyballskool.com");
    expect(ics).toContain("END:VCALENDAR");
  });
});
