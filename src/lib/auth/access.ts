import type { Community, Membership, Profile } from "@/lib/types/database";

export function hasActiveCommunityAccess(
  user: Profile,
  community: Community,
  membership: Membership | null
): boolean {
  return (
    user.is_super_admin ||
    community.owner_id === user.id ||
    membership?.status === "active"
  );
}

export function shouldSeePaywall(
  user: Profile,
  community: Community,
  membership: Membership | null
): boolean {
  if (hasActiveCommunityAccess(user, community, membership)) return false;
  if (!membership || membership.rejoin_blocked) return false;
  return (
    membership.status === "pending" ||
    membership.status === "cancelled" ||
    membership.status === "expired"
  );
}

export function canStartCheckout(
  membership: { status: string; rejoin_blocked?: boolean | null } | null
): boolean {
  if (!membership || membership.rejoin_blocked) return false;
  return (
    membership.status === "pending" ||
    membership.status === "cancelled" ||
    membership.status === "expired"
  );
}

export function joinAccessFromStatus(
  status: string | null | undefined
): "active" | "paywall" {
  return status === "active" ? "active" : "paywall";
}

export function postJoinPath(
  slug: string,
  access: "active" | "paywall"
): string {
  return access === "active" ? `/c/${slug}/forum` : `/c/${slug}/entrar`;
}
