export const HUB_ZONES = [
  { id: "Europe/Madrid", label: "España", short: "ES" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina", short: "AR" },
  { id: "America/Mexico_City", label: "México", short: "MX" },
] as const;

export type HubZoneId = (typeof HUB_ZONES)[number]["id"];

export const CALENDAR_DAY_ZONE: HubZoneId = "America/Argentina/Buenos_Aires";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isHubZone(timeZone: string): timeZone is HubZoneId {
  return HUB_ZONES.some((hub) => hub.id === timeZone);
}

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return asUtc - date.getTime();
}

export function wallTimeToUtc(wall: string, timeZone: string): Date | null {
  const match = wall.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match || !isValidTimeZone(timeZone)) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const first = new Date(utcGuess.getTime() - offsetMs(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - offsetMs(first, timeZone));
}

export function dayKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
