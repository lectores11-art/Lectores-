import { createServiceClient } from "@/lib/supabase/server";

/**
 * Temporary testing bypass: invite still required, Stripe checkout skipped.
 *
 * On local `next dev` always on.
 * Elsewhere: set ALLOW_UNPAID_INVITE_ACCESS=true.
 * Turn OFF before real payments.
 */
export function allowUnpaidInviteAccess(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const raw = process.env.ALLOW_UNPAID_INVITE_ACCESS?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Promotes unpaid invite memberships to active when bypass is on.
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

    // Prefer id-only update (no status filter) so odd rows still unlock.
    let query = service.from("memberships").update(patch);

    if (params.membershipId) {
      query = query.eq("id", params.membershipId);
    } else {
      query = query
        .eq("user_id", params.userId)
        .eq("community_id", params.communityId);
    }

    const { data, error } = await query.select("id, status");

    if (error) {
      console.error("unpaid invite bypass activate failed:", error);
      return false;
    }

    if (!data?.length) {
      console.error("unpaid invite bypass: no membership row updated", params);
      return false;
    }

    console.info("unpaid invite bypass: membership activated", data[0]);
    return true;
  } catch (err) {
    console.error("unpaid invite bypass threw:", err);
    return false;
  }
}
