import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { stripeAccountOptions } from "@/lib/billing/stripe-connect";
import { internalErrorResponse } from "@/lib/validation";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, community:communities(stripe_account_id), subscriptions(stripe_subscription_id)")
      .eq("user_id", user.id);

    if (stripe) {
      for (const row of memberships || []) {
        const community = Array.isArray(row.community) ? row.community[0] : row.community;
        const connected =
          community && typeof community === "object"
            ? (community as { stripe_account_id?: string | null }).stripe_account_id
            : null;
        const subs = Array.isArray(row.subscriptions)
          ? row.subscriptions
          : row.subscriptions
            ? [row.subscriptions]
            : [];
        for (const sub of subs) {
          const id = (sub as { stripe_subscription_id?: string | null }).stripe_subscription_id;
          if (!id) continue;
          try {
            await stripe.subscriptions.update(
              id,
              { cancel_at_period_end: true },
              stripeAccountOptions(connected)
            );
          } catch (err) {
            console.error("account delete: stripe cancel failed", err);
          }
        }
      }
    }

    const service = await createServiceClient();
    const tombstoneEmail = `deleted-${user.id}@invalid.local`;
    const { error } = await service
      .from("profiles")
      .update({
        full_name: "Cuenta eliminada",
        avatar_url: null,
        email: tombstoneEmail,
        residence_country: null,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return internalErrorResponse("account delete profile:", error);
    }

    try {
      await service.auth.admin.updateUserById(user.id, {
        email: tombstoneEmail,
        ban_duration: "876000h",
      });
    } catch (err) {
      console.error("account delete: auth update failed", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalErrorResponse("POST /api/account/delete failed:", err);
  }
}
