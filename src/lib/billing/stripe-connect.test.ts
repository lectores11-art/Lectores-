import { describe, expect, it } from "vitest";
import {
  checkoutIdempotencyKey,
  connectAccountIdempotencyKey,
  connectedAccountFromEvent,
  stripeAccountOptions,
} from "./stripe-connect";

describe("stripeAccountOptions", () => {
  it("omits the header when there is no connected account", () => {
    expect(stripeAccountOptions(null)).toBeUndefined();
    expect(stripeAccountOptions(undefined)).toBeUndefined();
    expect(stripeAccountOptions("")).toBeUndefined();
  });

  it("sets Stripe-Account when there is an acct id", () => {
    expect(stripeAccountOptions("acct_1")).toEqual({ stripeAccount: "acct_1" });
  });
});

describe("connectedAccountFromEvent", () => {
  it("reads event.account from Connect webhooks", () => {
    expect(connectedAccountFromEvent({ account: "acct_1" })).toBe("acct_1");
    expect(connectedAccountFromEvent({})).toBeUndefined();
  });
});

describe("idempotency keys", () => {
  it("scopes Checkout retries to the membership", () => {
    expect(checkoutIdempotencyKey("mem-1")).toBe("checkout:mem-1");
  });

  it("scopes Connect account creation to the community", () => {
    expect(connectAccountIdempotencyKey("com-1")).toBe("connect-account:com-1");
  });
});
