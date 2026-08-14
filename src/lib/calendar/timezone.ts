export const EVENT_TIMEZONES: { id: string; label: string }[] = [
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires (Argentina)" },
  { id: "America/Montevideo", label: "Montevideo (Uruguay)" },
  { id: "America/Santiago", label: "Santiago (Chile)" },
  { id: "America/Sao_Paulo", label: "São Paulo (Brasil)" },
  { id: "America/Bogota", label: "Bogotá (Colombia)" },
  { id: "America/Lima", label: "Lima (Perú)" },
  { id: "America/Mexico_City", label: "Ciudad de México" },
  { id: "America/New_York", label: "Nueva York (EE.UU.)" },
  { id: "America/Chicago", label: "Chicago (EE.UU.)" },
  { id: "America/Los_Angeles", label: "Los Ángeles (EE.UU.)" },
  { id: "Europe/Madrid", label: "Madrid (España)" },
  { id: "Europe/London", label: "Londres (Reino Unido)" },
  { id: "UTC", label: "UTC" },
];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function viewerTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(zone) ? zone : "UTC";
}

export function timezonesForSelect(viewer: string): { id: string; label: string }[] {
  const known = EVENT_TIMEZONES.filter((zone) => zone.id === viewer);
  if (known.length) return EVENT_TIMEZONES;
  return [{ id: viewer, label: viewer.replace(/_/g, " ") }, ...EVENT_TIMEZONES];
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
  const secondPass = new Date(utcGuess.getTime() - offsetMs(first, timeZone));
  return secondPass;
}

export function dayKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
