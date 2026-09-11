import { createServiceClient } from "@/lib/supabase/server";

/**
 * Temporary testing bypass: invite still required, Stripe checkout skipped.
 * Set ALLOW_UNPAID_INVITE_ACCESS=true only on local/staging.
 * Turn OFF before real payments — anyone with a valid invite gets full access.
 */
export function allowUnpaidInviteAccess(): boolean {
  return process.env.ALLOW_UNPAID_INVITE_ACCESS === "true";
}

/** Promotes pending (invite-accepted, unpaid) memberships to active when bypass is on. */
export async function activatePendingMembershipForUnpaidBypass(params: {
  userId: string;
  communityId: string;
}): Promise<boolean> {
  if (!allowUnpaidInviteAccess()) return false;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("memberships")
    .update({
      status: "active",
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("community_id", params.communityId)
    .eq("status", "pending")
    .or("rejoin_blocked.is.null,rejoin_blocked.eq.false")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("unpaid invite bypass activate failed:", error);
    return false;
  }
  return Boolean(data?.id);
}
