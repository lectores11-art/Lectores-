import { createServiceClient } from "@/lib/supabase/server";

/**
 * Temporary testing bypass flag.
 * On local `next dev` always on.
 * Elsewhere: set ALLOW_UNPAID_INVITE_ACCESS=true.
 */
export function allowUnpaidInviteAccess(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const raw = process.env.ALLOW_UNPAID_INVITE_ACCESS?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Promotes unpaid invite memberships to active.
 * Caller decides when (no Stripe yet, or explicit bypass). Do not gate here.
 */
export async function activatePendingMembershipForUnpaidBypass(params: {
  userId: string;
  communityId: string;
  membershipId?: string;
}): Promise<boolean> {
  try {
    const service = await createServiceClient();
    const patch = {
      status: "active" as const,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

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
      console.error("membership activate failed:", error);
      return false;
    }

    if (!data?.length) {
      console.error("membership activate: no row updated", params);
      return false;
    }

    console.info("membership activated (unpaid / no-stripe)", data[0]);
    return true;
  } catch (err) {
    console.error("membership activate threw:", err);
    return false;
  }
}
