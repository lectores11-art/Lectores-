import { describe, expect, it } from "vitest";
import {
  countPaidMembers,
  formatEurFromCents,
  monthlyEstimateCents,
} from "./paid-members";

describe("countPaidMembers", () => {
  it("counts members and skips the owner", () => {
    expect(
      countPaidMembers([
        { role: "community_owner", is_owner: true },
        { role: "member" },
        { role: "member" },
      ])
    ).toBe(2);
  });
});

describe("monthlyEstimateCents", () => {
  it("multiplies paid members by the monthly price", () => {
    expect(monthlyEstimateCents(150, 1900)).toBe(285_000);
  });
});

describe("formatEurFromCents", () => {
  it("formats euros for the admin total", () => {
    expect(formatEurFromCents(1900)).toMatch(/19/);
    expect(formatEurFromCents(1900)).toMatch(/€/);
  });
});
