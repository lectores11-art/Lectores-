import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { canStartCheckout } from "@/lib/auth/access";
import {
  communityCanCharge,
  platformFeePercent,
} from "@/lib/billing/platform-fee";
import { stripeAccountOptions, checkoutIdempotencyKey } from "@/lib/billing/stripe-connect";
import {
  internalErrorResponse,
  parseJsonBody,
  subscriptionCreateSchema,
  subscriptionDeleteSchema,
} from "@/lib/validation";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const bodyResult = await parseJsonBody(request, subscriptionCreateSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { communityId } = bodyResult.data;

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no configurado. Definí STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: community } = await supabase
      .from("communities")
      .select(
        "id, slug, name, stripe_price_id, stripe_account_id, stripe_charges_enabled, monthly_price_cents, commission_starts_at"
      )
      .eq("id", communityId)
      .single();

    if (!community) {
      return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
    }

    // Invite join creates pending; payment is the door. Do not undo a kick.
    const { data: membership } = await supabase
      .from("memberships")
      .select("id, status, rejoin_blocked")
      .eq("user_id", user.id)
      .eq("community_id", communityId)
      .maybeSingle();

    if (!membership || !canStartCheckout(membership)) {
      return NextResponse.json(
        { error: "Necesitás una invitación vigente para suscribirte." },
        { status: 403 }
      );
    }

    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("status, stripe_subscription_id")
      .eq("membership_id", membership.id)
      .maybeSingle();

    if (
      existingSub &&
      (existingSub.status === "active" ||
        existingSub.status === "trialing" ||
        existingSub.status === "past_due")
    ) {
      return NextResponse.json(
        {
          error: "Ya hay un cobro en curso. Recargá esta página en un momento.",
        },
        { status: 409 }
      );
    }

    if (!communityCanCharge(community) || !community.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            "El cobro no está listo. La dueña tiene que conectar Stripe en Admin.",
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const successUrl = `${appUrl}/c/${community.slug}/entrar?subscribed=true`;
    const cancelUrl = `${appUrl}/c/${community.slug}/entrar`;
    const metadata = {
      user_id: user.id,
      community_id: communityId,
      membership_id: membership.id,
    };

    const fee = platformFeePercent(
      community.commission_starts_at ?? new Date().toISOString()
    );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: community.monthly_price_cents,
              recurring: { interval: "month" },
              product_data: {
                name: `Membresía ${community.name}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        subscription_data: {
          metadata,
          application_fee_percent: fee,
        },
      },
      {
        ...stripeAccountOptions(community.stripe_account_id),
        idempotencyKey: checkoutIdempotencyKey(membership.id),
      }
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return internalErrorResponse("POST /api/subscriptions failed:", err);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const bodyResult = await parseJsonBody(request, subscriptionDeleteSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { membershipId } = bodyResult.data;

    const supabase = await createClient();

    const { data: membership } = await supabase
      .from("memberships")
      .select("*, subscriptions(*), community:communities(stripe_account_id)")
      .eq("id", membershipId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
    }

    const subscription = Array.isArray(membership.subscriptions)
      ? membership.subscriptions[0]
      : membership.subscriptions;

    const communityRow = Array.isArray(membership.community)
      ? membership.community[0]
      : membership.community;
    const connectedAccount =
      communityRow && typeof communityRow === "object"
        ? (communityRow as { stripe_account_id?: string | null }).stripe_account_id
        : null;

    if (stripe && subscription?.stripe_subscription_id) {
      await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        { cancel_at_period_end: true },
        stripeAccountOptions(connectedAccount)
      );
    }

    await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true, status: "cancelled" })
      .eq("membership_id", membershipId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return internalErrorResponse("DELETE /api/subscriptions failed:", err);
  }
}
