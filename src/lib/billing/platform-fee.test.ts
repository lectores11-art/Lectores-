import { describe, expect, it } from "vitest";
import { communityCanCharge, platformFeePercent } from "./platform-fee";

describe("platformFeePercent", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");

  it("is 60% for the first 30 days including launch day", () => {
    expect(platformFeePercent(start, new Date("2026-09-01T12:00:00.000Z"))).toBe(60);
    expect(platformFeePercent(start, new Date("2026-09-30T23:00:00.000Z"))).toBe(60);
  });

  it("is 40% in days 31–60", () => {
    expect(platformFeePercent(start, new Date("2026-10-01T00:00:00.000Z"))).toBe(40);
    expect(platformFeePercent(start, new Date("2026-10-30T00:00:00.000Z"))).toBe(40);
  });

  it("is 20% in days 61–90", () => {
    expect(platformFeePercent(start, new Date("2026-10-31T00:00:00.000Z"))).toBe(20);
    expect(platformFeePercent(start, new Date("2026-11-29T00:00:00.000Z"))).toBe(20);
  });

  it("is 0% from day 91", () => {
    expect(platformFeePercent(start, new Date("2026-11-30T00:00:00.000Z"))).toBe(0);
    expect(platformFeePercent(start, new Date("2027-01-01T00:00:00.000Z"))).toBe(0);
  });

  it("treats a launch in the future as the first window", () => {
    expect(platformFeePercent(start, new Date("2026-08-01T00:00:00.000Z"))).toBe(60);
  });
});

describe("communityCanCharge", () => {
  it("allows Connect when charges are enabled and there is a monthly price", () => {
    expect(
      communityCanCharge({
        stripe_account_id: "acct_1",
        stripe_charges_enabled: true,
        monthly_price_cents: 1900,
      })
    ).toBe(true);
  });

  it("ignores leftover platform price_id and incomplete Connect", () => {
    expect(communityCanCharge({ monthly_price_cents: 1900 })).toBe(false);
    expect(
      communityCanCharge({
        stripe_account_id: "acct_1",
        stripe_charges_enabled: false,
        monthly_price_cents: 1900,
      })
    ).toBe(false);
  });
});
