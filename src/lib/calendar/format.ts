import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const WEEK_STARTS_ON = 1 as const;

export type CalendarExportEvent = {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  url?: string | null;
};

export function monthGridDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start, end }).map((day) => startOfDay(day));
}

export function visibleRange(month: Date): { start: Date; end: Date } {
  const days = monthGridDays(month);
  const last = days[days.length - 1];
  return {
    start: days[0],
    end: new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59, 999),
  };
}

export function formatEventTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours < 12 ? "am" : "pm";
  if (minutes === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function formatEventChip(startsAt: Date, title: string): string {
  return `${formatEventTime(startsAt)} - ${title.trim()}`;
}

export function formatEventWhen(startsAt: Date, endsAt?: Date | null): string {
  const weekday = startsAt.toLocaleDateString("es-AR", { weekday: "long" });
  const month = startsAt.toLocaleDateString("es-AR", { month: "long" });
  const day = startsAt.getDate();
  const start = formatEventTime(startsAt);
  const range = endsAt ? `${start} - ${formatEventTime(endsAt)}` : start;
  return `${weekday}, ${month} ${day}° @ ${range}`;
}

export function timezoneCity(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const segment = timeZone.split("/").pop() || timeZone;
  return segment.replace(/_/g, " ");
}

export function formatTimezoneCaption(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  return `Hora de ${timezoneCity(timeZone)}`;
}

export function formatClockLabel(
  now: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(now);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const period = (parts.find((part) => part.type === "dayPeriod")?.value ?? "pm")
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toLowerCase();

  return `${hour}:${minute}${period} hora de ${timezoneCity(timeZone)}`;
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
    startdt: event.startsAt.toISOString(),
    enddt: event.endsAt.toISOString(),
    body: event.description || "",
  });
  if (event.url) params.set("location", event.url);
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function icsContent(event: CalendarExportEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lectores//Calendar//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
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
