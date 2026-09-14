import { describe, expect, it } from "vitest";
import type { Community, Membership, Profile } from "@/lib/types/database";
import {
  canStartCheckout,
  hasActiveCommunityAccess,
  joinAccessFromStatus,
  postJoinPath,
  shouldSeePaywall,
} from "./access";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    email: "a@example.com",
    full_name: "Ana",
    avatar_url: null,
    is_super_admin: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function community(overrides: Partial<Community> = {}): Community {
  return {
    id: "com-1",
    slug: "club",
    name: "Club",
    description: null,
    logo_url: null,
    accent_color: "#E85D2A",
    owner_id: "owner-1",
    is_active: true,
    stripe_price_id: "price_1",
    stripe_account_id: null,
    stripe_charges_enabled: false,
    commission_starts_at: "",
    monthly_price_cents: 1900,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: "mem-1",
    user_id: "user-1",
    community_id: "com-1",
    role: "member",
    status: "pending",
    joined_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("hasActiveCommunityAccess", () => {
  it("lets the owner in without paying", () => {
    expect(
      hasActiveCommunityAccess(
        profile({ id: "owner-1" }),
        community(),
        membership({ status: "pending" })
      )
    ).toBe(true);
  });

  it("lets super admin in", () => {
    expect(
      hasActiveCommunityAccess(
        profile({ is_super_admin: true }),
        community(),
        null
      )
    ).toBe(true);
  });

  it("lets an active member in", () => {
    expect(
      hasActiveCommunityAccess(
        profile(),
        community(),
        membership({ status: "active" })
      )
    ).toBe(true);
  });

  it("blocks a pending member", () => {
    expect(
      hasActiveCommunityAccess(profile(), community(), membership())
    ).toBe(false);
  });
});

describe("shouldSeePaywall", () => {
  const billable = () =>
    community({
      stripe_account_id: "acct_123",
      stripe_charges_enabled: true,
      monthly_price_cents: 1900,
    });

  it("shows paywall for pending invitees when the club can charge", () => {
    expect(shouldSeePaywall(profile(), billable(), membership())).toBe(true);
  });

  it("hides paywall when the club cannot charge yet (no Stripe)", () => {
    expect(shouldSeePaywall(profile(), community(), membership())).toBe(false);
  });

  it("shows paywall after cancelled or expired access when billable", () => {
    expect(
      shouldSeePaywall(
        profile(),
        billable(),
        membership({ status: "cancelled" })
      )
    ).toBe(true);
    expect(
      shouldSeePaywall(
        profile(),
        billable(),
        membership({ status: "expired" })
      )
    ).toBe(true);
  });

  it("hides paywall for owner, admin, and paying members", () => {
    expect(
      shouldSeePaywall(profile({ id: "owner-1" }), billable(), membership())
    ).toBe(false);
    expect(
      shouldSeePaywall(
        profile(),
        billable(),
        membership({ status: "active" })
      )
    ).toBe(false);
  });

  it("hides paywall when kicked", () => {
    expect(
      shouldSeePaywall(
        profile(),
        billable(),
        membership({ rejoin_blocked: true })
      )
    ).toBe(false);
  });

  it("hides paywall when there is no membership", () => {
    expect(shouldSeePaywall(profile(), billable(), null)).toBe(false);
  });
});

describe("canStartCheckout", () => {
  it("allows unpaid invitees and former members", () => {
    expect(canStartCheckout(membership())).toBe(true);
    expect(canStartCheckout(membership({ status: "cancelled" }))).toBe(true);
  });

  it("blocks active, kicked, and missing membership", () => {
    expect(canStartCheckout(membership({ status: "active" }))).toBe(false);
    expect(canStartCheckout(membership({ rejoin_blocked: true }))).toBe(false);
    expect(canStartCheckout(null)).toBe(false);
  });
});

describe("join redirect", () => {
  it("sends unpaid joiners to /entrar", () => {
    expect(joinAccessFromStatus("pending")).toBe("paywall");
    expect(postJoinPath("club", "paywall")).toBe("/c/club/entrar");
  });

  it("sends already-active members to the forum", () => {
    expect(joinAccessFromStatus("active")).toBe("active");
    expect(postJoinPath("club", "active")).toBe("/c/club/forum");
  });
});
