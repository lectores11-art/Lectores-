import { normalizeCountryCode, WORLDWIDE_TERRITORY } from "./countries";

export const LEGAL_CATEGORIES = [
  "public_domain",
  "open_license",
  "rights_holder",
  "catalog",
] as const;

export type LegalCategory = (typeof LEGAL_CATEGORIES)[number];

export function isLegalCategory(value: unknown): value is LegalCategory {
  return (
    typeof value === "string" &&
    (LEGAL_CATEGORIES as readonly string[]).includes(value)
  );
}

function normalizeTerritories(territories: string[] | null | undefined): string[] {
  if (!territories) return [];
  const out = new Set<string>();
  for (const item of territories) {
    const code = normalizeCountryCode(item);
    if (code) out.add(code);
  }
  return [...out];
}

function isWorldwide(territories: string[]): boolean {
  return territories.includes(WORLDWIDE_TERRITORY);
}

function categoryIsWorldwide(category: LegalCategory | null): boolean {
  return category === "public_domain" || category === "open_license";
}

export function canOpenBookPdf(input: {
  hasPdf: boolean;
  isHidden?: boolean;
  category: LegalCategory | null;
  territories: string[] | null | undefined;
  residenceCountry: string | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.hasPdf) return { ok: false, reason: "no_pdf" };
  if (input.isHidden) return { ok: false, reason: "hidden" };
  if (!input.category || input.category === "catalog") {
    return { ok: false, reason: "no_license" };
  }

  if (categoryIsWorldwide(input.category)) {
    return { ok: true };
  }

  const residence = normalizeCountryCode(input.residenceCountry);
  if (!residence || residence === WORLDWIDE_TERRITORY) {
    return { ok: false, reason: "no_residence" };
  }

  const territories = normalizeTerritories(input.territories);
  if (isWorldwide(territories) || territories.includes(residence)) {
    return { ok: true };
  }

  return { ok: false, reason: "territory" };
}

export function bookLicenseColumns(input: {
  legalCategory: LegalCategory;
  licenseTerritories: string[];
  rightsHolderName?: string | null;
  licenseExpiresAt?: string | null;
  allowsLiveDisplay?: boolean;
  allowsRecording?: boolean;
  licenseAttested: boolean;
  coverRightsAttested: boolean;
}) {
  const now = new Date().toISOString();
  return {
    legal_category: input.legalCategory,
    license_territories: input.licenseTerritories,
    rights_holder_name: input.rightsHolderName || null,
    license_expires_at: input.licenseExpiresAt || null,
    allows_live_display: Boolean(input.allowsLiveDisplay),
    allows_recording: Boolean(input.allowsRecording),
    license_attested_at: input.licenseAttested ? now : null,
    cover_rights_attested_at: input.coverRightsAttested ? now : null,
  };
}

export function countMembersByCountry(
  countries: Array<string | null | undefined>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of countries) {
    const code = normalizeCountryCode(value);
    if (!code || code === WORLDWIDE_TERRITORY) continue;
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

export function uncoveredResidenceCountries(
  memberCountries: Array<string | null | undefined>,
  territories: string[] | null | undefined,
  category: LegalCategory | null
): string[] {
  if (!category || category === "catalog" || categoryIsWorldwide(category)) {
    return [];
  }
  const licensed = normalizeTerritories(territories);
  if (isWorldwide(licensed)) return [];

  const uncovered = new Set<string>();
  for (const value of memberCountries) {
    const code = normalizeCountryCode(value);
    if (!code || code === WORLDWIDE_TERRITORY) continue;
    if (!licensed.includes(code)) uncovered.add(code);
  }
  return [...uncovered].sort();
}
