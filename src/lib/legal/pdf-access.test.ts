import { describe, expect, it } from "vitest";
import {
  canOpenBookPdf,
  countMembersByCountry,
  uncoveredResidenceCountries,
} from "./pdf-access";

const base = {
  hasPdf: true,
  isHidden: false,
  category: "rights_holder" as const,
  territories: ["ES", "AR"],
  residenceCountry: "ES",
};

describe("canOpenBookPdf", () => {
  it("denies catalog books even with a path", () => {
    expect(
      canOpenBookPdf({ ...base, category: "catalog" }).ok
    ).toBe(false);
  });

  it("denies missing category or pdf", () => {
    expect(canOpenBookPdf({ ...base, category: null }).ok).toBe(false);
    expect(canOpenBookPdf({ ...base, hasPdf: false }).ok).toBe(false);
  });

  it("denies hidden books", () => {
    expect(canOpenBookPdf({ ...base, isHidden: true }).ok).toBe(false);
  });

  it("allows public domain and open license in any declared country", () => {
    expect(
      canOpenBookPdf({
        ...base,
        category: "public_domain",
        territories: [],
        residenceCountry: "MX",
      }).ok
    ).toBe(true);
    expect(
      canOpenBookPdf({
        ...base,
        category: "open_license",
        territories: ["ES"],
        residenceCountry: "CO",
      }).ok
    ).toBe(true);
  });

  it("allows rights_holder only when residence is in the license list", () => {
    expect(canOpenBookPdf(base).ok).toBe(true);
    expect(canOpenBookPdf({ ...base, residenceCountry: "MX" }).ok).toBe(false);
    expect(canOpenBookPdf({ ...base, residenceCountry: null }).ok).toBe(false);
  });

  it("treats * as worldwide for rights_holder", () => {
    expect(
      canOpenBookPdf({
        ...base,
        territories: ["*"],
        residenceCountry: "JP",
      }).ok
    ).toBe(true);
  });
});

describe("countMembersByCountry", () => {
  it("counts declared countries and skips empty", () => {
    expect(countMembersByCountry(["ES", "es", "AR", null, ""])).toEqual({
      ES: 2,
      AR: 1,
    });
  });
});

describe("uncoveredResidenceCountries", () => {
  it("returns member countries outside a rights_holder license", () => {
    expect(
      uncoveredResidenceCountries(["ES", "MX", "AR"], ["ES", "AR"], "rights_holder")
    ).toEqual(["MX"]);
  });

  it("returns none for public domain or worldwide", () => {
    expect(
      uncoveredResidenceCountries(["MX"], ["ES"], "public_domain")
    ).toEqual([]);
    expect(
      uncoveredResidenceCountries(["MX"], ["*"], "rights_holder")
    ).toEqual([]);
  });
});
