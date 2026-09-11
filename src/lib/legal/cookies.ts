export const COOKIE_CONSENT_KEY = "hilo_cookie_consent";

export type CookieConsent = {
  necessary: true;
  embeds: boolean;
  decidedAt: string;
};

export function parseCookieConsent(raw: string | null | undefined): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed.necessary !== true) return null;
    if (typeof parsed.embeds !== "boolean") return null;
    if (typeof parsed.decidedAt !== "string" || !parsed.decidedAt) return null;
    return {
      necessary: true,
      embeds: parsed.embeds,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return null;
  }
}

export function isEmbedAllowed(consent: CookieConsent | null): boolean {
  return consent?.embeds === true;
}

export function serializeCookieConsent(embeds: boolean, at = new Date()): string {
  const value: CookieConsent = {
    necessary: true,
    embeds,
    decidedAt: at.toISOString(),
  };
  return JSON.stringify(value);
}
