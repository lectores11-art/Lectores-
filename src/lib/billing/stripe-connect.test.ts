import { describe, expect, it } from "vitest";
import {
  checkoutIdempotencyKey,
  connectAccountIdempotencyKey,
  connectedAccountFromEvent,
  publicConnectError,
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

describe("publicConnectError", () => {
  it("maps a missing Connect column to the 013 migration", () => {
    expect(
      publicConnectError({
        message: 'column "stripe_account_id" does not exist',
        code: "42703",
      })
    ).toBe(
      "Falta la migración 013 en Supabase. Ejecutá 013 y 014 en el SQL Editor."
    );
  });

  it("passes Stripe API messages through", () => {
    expect(
      publicConnectError({
        raw: { message: "This application is not setup for Connect." },
      })
    ).toBe("This application is not setup for Connect.");
  });
});
