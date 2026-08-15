import {
  CALENDAR_DAY_ZONE,
  HUB_ZONES,
  civilUtcNoon,
  utcCivilKey,
  wallTimeToUtc,
  ymdInZone,
} from "@/lib/calendar/timezone";

export const MONTH_GRID_DAYS = 42;

const WEEKDAY_MON0: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function weekdayMon0InZone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(date);
  return WEEKDAY_MON0[weekday] ?? 0;
}

function addCivilDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export type CalendarExportEvent = {
  uid?: string | null;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  url?: string | null;
};

export type EventRangeResult =
  | { ok: true; startsAt: Date; endsAt: Date }
  | { ok: false; error: string };

export function monthGridDays(month: Date): Date[] {
  const { year, month: monthNum } = ymdInZone(month, CALENDAR_DAY_ZONE);
  const first = wallTimeToUtc(
    `${year}-${pad2(monthNum)}-01T12:00`,
    CALENDAR_DAY_ZONE
  );
  if (!first) return [];

  const start = addCivilDays(year, monthNum, 1, -weekdayMon0InZone(first, CALENDAR_DAY_ZONE));
  return Array.from({ length: MONTH_GRID_DAYS }, (_, index) => {
    const civil = addCivilDays(start.year, start.month, start.day, index);
    return civilUtcNoon(civil.year, civil.month, civil.day);
  });
}

export function resolveEventRange(
  startsAt: Date,
  endsAt?: Date | null
): EventRangeResult {
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "La fecha de inicio no es válida." };
  }
  const end =
    endsAt && !Number.isNaN(endsAt.getTime())
      ? endsAt
      : new Date(startsAt.getTime() + 60 * 60 * 1000);
  if (end.getTime() <= startsAt.getTime()) {
    return {
      ok: false,
      error: "La hora de fin tiene que ser posterior al inicio.",
    };
  }
  return { ok: true, startsAt, endsAt: end };
}

export function visibleRange(month: Date): { start: Date; end: Date } {
  const days = monthGridDays(month);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    return { start: month, end: month };
  }

  const start = wallTimeToUtc(`${utcCivilKey(first)}T00:00:00`, CALENDAR_DAY_ZONE);
  const lastCivil = addCivilDays(
    last.getUTCFullYear(),
    last.getUTCMonth() + 1,
    last.getUTCDate(),
    1
  );
  const end = wallTimeToUtc(
    `${lastCivil.year}-${pad2(lastCivil.month)}-${pad2(lastCivil.day)}T00:00:00`,
    CALENDAR_DAY_ZONE
  );
  if (!start || !end) {
    return { start: first, end: last };
  }
  return { start, end };
}

export function formatEventTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const period = (parts.find((part) => part.type === "dayPeriod")?.value ?? "pm")
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toLowerCase();

  if (minute === "00") return `${hour}${period}`;
  return `${hour}:${minute}${period}`;
}

export function formatHubTimes(date: Date): Array<{
  id: string;
  label: string;
  short: string;
  time: string;
}> {
  return HUB_ZONES.map((hub) => ({
    id: hub.id,
    label: hub.label,
    short: hub.short,
    time: formatEventTime(date, hub.id),
  }));
}

export function formatHubChipLine(date: Date): string {
  return formatHubTimes(date)
    .map((hub) => `${hub.time} ${hub.short}`)
    .join(" · ");
}

export function formatHubClockLine(now: Date): string {
  return formatHubTimes(now)
    .map((hub) => `${hub.time} ${hub.label}`)
    .join(" · ");
}

export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/g, "");
}

function utcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function googleCalendarUrl(event: CalendarExportEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt)}`,
    details: event.description || "",
  });
  if (event.url) params.set("location", event.url);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarExportEvent): string {
  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: isoNoMs(event.startsAt),
    enddt: isoNoMs(event.endsAt),
    body: event.description || "",
  });
  if (event.url) params.set("location", event.url);
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

function icsUid(event: CalendarExportEvent): string {
  const raw = (event.uid || "").trim();
  if (raw.includes("@")) return raw;
  if (raw) return `${raw}@lectores`;
  return `${utcStamp(event.startsAt)}@lectores`;
}

function isoNoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function icsContent(event: CalendarExportEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lectores//Calendar//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(icsUid(event))}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.url) lines.push(`URL:${escapeIcs(event.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "evento"}.ics`;
}
