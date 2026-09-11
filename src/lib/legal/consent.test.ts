import { describe, expect, it } from "vitest";
import { hasCompletedLegalConsent } from "./consent";

describe("hasCompletedLegalConsent", () => {
  const complete = {
    accepted_terms_at: "2026-09-09T12:00:00Z",
    accepted_privacy_at: "2026-09-09T12:00:00Z",
    age_attested_at: "2026-09-09T12:00:00Z",
    residence_country: "ES",
    deleted_at: null,
  };

  it("requires terms, privacy, age and residence country", () => {
    expect(hasCompletedLegalConsent(complete)).toBe(true);
    expect(
      hasCompletedLegalConsent({ ...complete, accepted_terms_at: null })
    ).toBe(false);
    expect(
      hasCompletedLegalConsent({ ...complete, residence_country: "" })
    ).toBe(false);
    expect(
      hasCompletedLegalConsent({ ...complete, deleted_at: "2026-09-09T12:00:00Z" })
    ).toBe(false);
  });
});
