import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireApiCommunityAccess } from "@/lib/auth/helpers";
import {
  internalErrorResponse,
  parseData,
  slugParamsSchema,
} from "@/lib/validation";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const OWNER_LEAVE_MESSAGE =
  "No podés salir siendo dueña de la comunidad. Transferí la propiedad primero.";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const access = await requireApiCommunityAccess(slug);
    if (access instanceof NextResponse) return access;
    const { user, community, membership } = access;

    const isOwner =
      community.owner_id === user.id || membership.role === "community_owner";
    if (isOwner) {
      return NextResponse.json({ error: OWNER_LEAVE_MESSAGE }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: membershipRow } = await supabase
      .from("memberships")
      .select("id, subscriptions(stripe_subscription_id, status)")
      .eq("id", membership.id)
      .eq("user_id", user.id)
      .eq("community_id", community.id)
      .single();

    if (!membershipRow) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
    }

    const subscription = Array.isArray(membershipRow.subscriptions)
      ? membershipRow.subscriptions[0]
      : membershipRow.subscriptions;

    if (stripe && subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (err) {
        console.error("leave: stripe cancel failed:", err);
      }
    }

    const service = await createServiceClient();

    if (subscription?.stripe_subscription_id) {
      await service
        .from("subscriptions")
        .update({ cancel_at_period_end: true, status: "cancelled" })
        .eq("membership_id", membershipRow.id);
    }

    // Soft-leave: mark membership cancelled (schema has no "inactive").
    const { error: leaveError } = await service
      .from("memberships")
      .update({ status: "cancelled" })
      .eq("id", membershipRow.id)
      .eq("user_id", user.id)
      .eq("community_id", community.id);

    if (leaveError) {
      return internalErrorResponse("Error al salir de la comunidad:", leaveError);
    }

    return NextResponse.json({ success: true, redirect: "/dashboard" });
  } catch (err) {
    return internalErrorResponse("DELETE /api/c/[slug]/membership failed:", err);
  }
}
