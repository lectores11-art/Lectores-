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
