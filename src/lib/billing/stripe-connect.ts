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
  return `connect-account:${communityId}`;
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
  return text.slice(0, 280);
}
