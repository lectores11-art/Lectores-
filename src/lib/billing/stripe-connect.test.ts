import { describe, expect, it } from "vitest";
import {
  checkoutIdempotencyKey,
  connectAccountIdempotencyKey,
  connectV2AccountCreateParams,
  connectV2AccountLinkCreateParams,
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
    expect(connectAccountIdempotencyKey("com-1")).toBe(
      "connect-account-v2:com-1"
    );
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

  it("maps Accounts v1 rejection to a short admin message", () => {
    expect(
      publicConnectError({
        message:
          "Stripe no longer recommends Accounts v1 for new Connect integrations. Create connected accounts with POST /v2/core/accounts instead.",
      })
    ).toBe(
      "Stripe ya no crea cuentas Connect con la API vieja. Recargá y volvé a pulsar Conectar Stripe."
    );
  });
});

describe("connectV2AccountCreateParams", () => {
  it("creates a Standard-equivalent merchant account in Spain", () => {
    const params = connectV2AccountCreateParams({
      communityId: "club-1",
      communityName: "Club Borges",
      ownerEmail: "duena@example.com",
    });
    expect(params.dashboard).toBe("full");
    expect(params.identity).toEqual({
      country: "es",
      entity_type: "individual",
    });
    expect(params.defaults?.currency).toBe("eur");
    expect(params.configuration?.merchant?.capabilities?.card_payments).toEqual({
      requested: true,
    });
    expect(params.metadata).toEqual({ community_id: "club-1" });
  });
});

describe("connectV2AccountLinkCreateParams", () => {
  it("onboards the merchant configuration", () => {
    const params = connectV2AccountLinkCreateParams({
      accountId: "acct_1",
      refreshUrl: "https://app.example/refresh",
      returnUrl: "https://app.example/return",
    });
    expect(params.account).toBe("acct_1");
    expect(params.use_case.type).toBe("account_onboarding");
    expect(params.use_case.account_onboarding?.configurations).toEqual([
      "merchant",
    ]);
  });
});
