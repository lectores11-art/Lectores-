export function hasCompletedLegalConsent(profile: {
  accepted_terms_at?: string | null;
  accepted_privacy_at?: string | null;
  age_attested_at?: string | null;
  residence_country?: string | null;
  deleted_at?: string | null;
}): boolean {
  if (profile.deleted_at) return false;
  return Boolean(
    profile.accepted_terms_at &&
      profile.accepted_privacy_at &&
      profile.age_attested_at &&
      profile.residence_country?.trim()
  );
}
