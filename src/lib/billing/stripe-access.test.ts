import { describe, expect, it } from "vitest";
import {
  joinedAtOnActivate,
  membershipStatusAfterStripeEvent,
} from "./stripe-access";

describe("membershipStatusAfterStripeEvent", () => {
  it("opens the community after checkout", () => {
    expect(
      membershipStatusAfterStripeEvent({ type: "checkout.session.completed" })
    ).toBe("active");
  });

  it("locks access when a monthly charge fails", () => {
    expect(
      membershipStatusAfterStripeEvent({ type: "invoice.payment_failed" })
    ).toBe("pending");
  });

  it("cancels membership when the subscription is deleted", () => {
    expect(
      membershipStatusAfterStripeEvent({
        type: "customer.subscription.deleted",
      })
    ).toBe("cancelled");
  });

  it("maps subscription updates to membership", () => {
    expect(
      membershipStatusAfterStripeEvent({
        type: "customer.subscription.updated",
        stripeStatus: "active",
      })
    ).toBe("active");
    expect(
      membershipStatusAfterStripeEvent({
        type: "customer.subscription.updated",
        stripeStatus: "past_due",
      })
    ).toBe("pending");
    expect(
      membershipStatusAfterStripeEvent({
        type: "customer.subscription.updated",
        stripeStatus: "canceled",
      })
    ).toBe("cancelled");
    expect(
      membershipStatusAfterStripeEvent({
        type: "customer.subscription.updated",
        stripeStatus: "incomplete",
      })
    ).toBe("unchanged");
  });
});

describe("joinedAtOnActivate", () => {
  it("keeps the first paid date on later activations", () => {
    expect(joinedAtOnActivate("2026-01-01T00:00:00.000Z", "2026-08-24T00:00:00.000Z")).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });

  it("sets joined_at on the first payment", () => {
    expect(joinedAtOnActivate(null, "2026-08-24T00:00:00.000Z")).toBe(
      "2026-08-24T00:00:00.000Z"
    );
  });
});
