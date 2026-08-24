export function countPaidMembers(
  members: Array<{ role: string; is_owner?: boolean }>
): number {
  return members.filter(
    (member) => member.role === "member" && !member.is_owner
  ).length;
}

export function monthlyEstimateCents(
  paidCount: number,
  monthlyPriceCents: number
): number {
  return paidCount * monthlyPriceCents;
}

export function formatEurFromCents(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
