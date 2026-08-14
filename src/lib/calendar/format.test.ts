import { describe, expect, it } from "vitest";
import {
  firstUrl,
  formatClockLabel,
  formatEventChip,
  formatEventTime,
  formatEventWhen,
  formatTimezoneCaption,
  googleCalendarUrl,
  icsContent,
  monthGridDays,
  outlookCalendarUrl,
  resolveEventRange,
  visibleRange,
} from "./format";

describe("monthGridDays", () => {
  it("returns 42 days starting Monday before August 2026", () => {
    const days = monthGridDays(new Date(2026, 7, 1));
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual(new Date(2026, 6, 27));
    expect(days[5]).toEqual(new Date(2026, 7, 1));
    expect(days[35]).toEqual(new Date(2026, 7, 31));
    expect(days[41]).toEqual(new Date(2026, 8, 6));
  });

  it("pads a 4-week February to 42 days", () => {
    const days = monthGridDays(new Date(2021, 1, 1));
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual(new Date(2021, 1, 1));
    expect(days[27]).toEqual(new Date(2021, 1, 28));
    expect(days[41]).toEqual(new Date(2021, 2, 14));
  });
});

describe("visibleRange", () => {
  it("ends at local 23:59:59.999 of the last painted cell", () => {
    const { start, end } = visibleRange(new Date(2021, 1, 1));
    expect(start).toEqual(new Date(2021, 1, 1));
    expect(end).toEqual(new Date(2021, 2, 14, 23, 59, 59, 999));
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
  it("omits minutes on the hour and lowercases am/pm", () => {
    expect(formatEventTime(new Date(2026, 7, 23, 15, 0))).toBe("3pm");
    expect(formatEventTime(new Date(2026, 7, 23, 9, 0))).toBe("9am");
  });

  it("keeps minutes when not on the hour", () => {
    expect(formatEventTime(new Date(2026, 7, 23, 15, 30))).toBe("3:30pm");
  });
});

describe("formatEventChip", () => {
  it("prefixes the 12-hour time to the title", () => {
    expect(
      formatEventChip(new Date(2026, 7, 23, 15, 0), "360 VA Skool Call")
    ).toBe("3pm - 360 VA Skool Call");
  });
});

describe("formatEventWhen", () => {
  it("formats weekday, month, ordinal day and time range", () => {
    expect(
      formatEventWhen(
        new Date(2026, 7, 23, 15, 0),
        new Date(2026, 7, 23, 16, 0)
      )
    ).toBe("domingo, agosto 23° @ 3pm - 4pm");
  });
});

describe("formatClockLabel", () => {
  it("shows local clock and city for Buenos Aires", () => {
    const now = new Date("2026-08-14T19:59:00-03:00");
    expect(
      formatClockLabel(now, "America/Argentina/Buenos_Aires")
    ).toBe("7:59pm hora de Buenos Aires");
  });
});

describe("formatTimezoneCaption", () => {
  it("capitalizes Hora de {city}", () => {
    expect(formatTimezoneCaption("America/Argentina/Buenos_Aires")).toBe(
      "Hora de Buenos Aires"
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
