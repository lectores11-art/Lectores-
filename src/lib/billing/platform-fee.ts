const DAY_MS = 86_400_000;

/** Platform share of each monthly charge. Clock is the community launch, not the member. */
export function platformFeePercent(
  startsAt: Date | string,
  now: Date = new Date()
): number {
  const startMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startMs)) return 60;
  const days = Math.floor((now.getTime() - startMs) / DAY_MS);
  if (days < 30) return 60;
  if (days < 60) return 40;
  if (days < 90) return 20;
  return 0;
}

export function communityCanCharge(community: {
  stripe_account_id?: string | null;
  stripe_charges_enabled?: boolean | null;
  monthly_price_cents?: number | null;
}): boolean {
  return (
    Boolean(community.stripe_account_id) &&
    Boolean(community.stripe_charges_enabled) &&
    (community.monthly_price_cents ?? 0) > 0
  );
}
