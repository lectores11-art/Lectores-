import { createServiceClient } from "@/lib/supabase/server";

/**
 * Temporary testing bypass: invite still required, Stripe checkout skipped.
 * Set ALLOW_UNPAID_INVITE_ACCESS=true only on local/staging.
 * Turn OFF before real payments — anyone with a valid invite gets full access.
 */
export function allowUnpaidInviteAccess(): boolean {
  const raw = process.env.ALLOW_UNPAID_INVITE_ACCESS?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Promotes unpaid invite memberships to active when bypass is on.
 * Prefer membershipId when known (layout); otherwise user+community.
 */
export async function activatePendingMembershipForUnpaidBypass(params: {
  userId: string;
  communityId: string;
  membershipId?: string;
}): Promise<boolean> {
  if (!allowUnpaidInviteAccess()) return false;

  try {
    const service = await createServiceClient();
    const patch = {
      status: "active" as const,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let query = service
      .from("memberships")
      .update(patch)
      .in("status", ["pending", "cancelled", "expired"]);

    if (params.membershipId) {
      // Caller already verified !rejoin_blocked when using membershipId.
      query = query.eq("id", params.membershipId);
    } else {
      // Invite-join path: kicked users never land here as pending via accept_invite.
      query = query
        .eq("user_id", params.userId)
        .eq("community_id", params.communityId);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("unpaid invite bypass activate failed:", error);
      return false;
    }

    if (!data?.length) {
      console.error("unpaid invite bypass: no membership row updated", params);
      return false;
    }

    return true;
  } catch (err) {
    console.error("unpaid invite bypass threw:", err);
    return false;
  }
}
