import type { MembershipStatus } from "@/lib/types/database";

export type StripeAccessEvent =
  | { type: "checkout.session.completed" }
  | { type: "invoice.payment_failed" }
  | { type: "customer.subscription.deleted" }
  | { type: "customer.subscription.updated"; stripeStatus: string };

export function membershipStatusAfterStripeEvent(
  event: StripeAccessEvent
): MembershipStatus | "unchanged" {
  switch (event.type) {
    case "checkout.session.completed":
      return "active";
    case "invoice.payment_failed":
      return "pending";
    case "customer.subscription.deleted":
      return "cancelled";
    case "customer.subscription.updated": {
      const status = event.stripeStatus;
      if (status === "active" || status === "trialing") return "active";
      if (status === "past_due" || status === "unpaid" || status === "paused") {
        return "pending";
      }
      if (status === "canceled" || status === "incomplete_expired") {
        return "cancelled";
      }
      return "unchanged";
    }
  }
}

export function joinedAtOnActivate(
  existing: string | null | undefined,
  nowIso: string
): string {
  return existing || nowIso;
}

/** Incomplete Checkout sessions can complete without a successful first charge. */
export function shouldActivateFromCheckout(
  paymentStatus: string | null | undefined
): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}
