export function stripeAccountOptions(stripeAccountId?: string | null): {
  stripeAccount: string;
} | undefined {
  if (!stripeAccountId) return undefined;
  return { stripeAccount: stripeAccountId };
}

export function connectedAccountFromEvent(event: { account?: string }): string | undefined {
  return typeof event.account === "string" && event.account
    ? event.account
    : undefined;
}

export function checkoutIdempotencyKey(membershipId: string): string {
  return `checkout:${membershipId}`;
}

export function connectAccountIdempotencyKey(communityId: string): string {
  return `connect-account-v2:${communityId}`;
}

/** Standard Connect (dueña cobra, Stripe dashboard completo) via Accounts v2. */
export function connectV2AccountCreateParams(input: {
  communityId: string;
  communityName: string;
  ownerEmail?: string | null;
}) {
  return {
    contact_email: input.ownerEmail || undefined,
    display_name: input.communityName,
    dashboard: "full" as const,
    identity: {
      country: "es",
      entity_type: "individual" as const,
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      currency: "eur",
      locales: ["es-ES" as const],
      responsibilities: {
        fees_collector: "stripe" as const,
        losses_collector: "stripe" as const,
      },
    },
    metadata: { community_id: input.communityId },
  };
}

export function connectV2AccountLinkCreateParams(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return {
    account: input.accountId,
    use_case: {
      type: "account_onboarding" as const,
      account_onboarding: {
        configurations: ["merchant" as const],
        collection_options: { fields: "eventually_due" as const },
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
      },
    },
  };
}

function errorText(err: unknown): string {
  if (!err) return "Error interno";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const record = err as {
      message?: string;
      code?: string;
      raw?: { message?: string };
    };
    return record.raw?.message || record.message || record.code || "Error interno";
  }
  return "Error interno";
}

/** Admin-facing Stripe/PostgREST errors (never leak stack traces). */
export function publicConnectError(err: unknown): string {
  const text = errorText(err);
  const lower = text.toLowerCase();
  if (
    lower.includes("stripe_account_id") ||
    lower.includes("stripe_charges_enabled") ||
    lower.includes("commission_starts_at") ||
    (lower.includes("does not exist") && lower.includes("column"))
  ) {
    return "Falta la migración 013 en Supabase. Ejecutá 013 y 014 en el SQL Editor.";
  }
  if (
    lower.includes("accounts v1") ||
    lower.includes("/v2/core/accounts")
  ) {
    return "Stripe ya no crea cuentas Connect con la API vieja. Recargá y volvé a pulsar Conectar Stripe.";
  }
  return text.slice(0, 280);
}
