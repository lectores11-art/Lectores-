import { describe, expect, it } from "vitest";
import { hasCompletedLegalConsent, REQUIRE_LEGAL_CONSENT } from "./consent";

describe("hasCompletedLegalConsent", () => {
  const complete = {
    accepted_terms_at: "2026-09-09T12:00:00Z",
    accepted_privacy_at: "2026-09-09T12:00:00Z",
    age_attested_at: "2026-09-09T12:00:00Z",
    residence_country: "ES",
    deleted_at: null,
  };

  it("blocks deleted profiles even when consent gate is off", () => {
    expect(
      hasCompletedLegalConsent({ ...complete, deleted_at: "2026-09-09T12:00:00Z" })
    ).toBe(false);
  });

  it(
    REQUIRE_LEGAL_CONSENT
      ? "requires terms, privacy, age and residence country"
      : "skips consent checks while REQUIRE_LEGAL_CONSENT is false",
    () => {
      if (!REQUIRE_LEGAL_CONSENT) {
        expect(hasCompletedLegalConsent(complete)).toBe(true);
        expect(
          hasCompletedLegalConsent({ ...complete, accepted_terms_at: null })
        ).toBe(true);
        expect(
          hasCompletedLegalConsent({ ...complete, residence_country: "" })
        ).toBe(true);
        return;
      }

      expect(hasCompletedLegalConsent(complete)).toBe(true);
      expect(
        hasCompletedLegalConsent({ ...complete, accepted_terms_at: null })
      ).toBe(false);
      expect(
        hasCompletedLegalConsent({ ...complete, residence_country: "" })
      ).toBe(false);
    }
  );
});
