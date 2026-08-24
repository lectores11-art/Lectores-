import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { canStartCheckout } from "@/lib/auth/access";
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
      .select("id, slug, stripe_price_id")
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

    const priceId = community.stripe_price_id;
    if (!priceId) {
      return NextResponse.json(
        {
          error:
            "Esta comunidad no tiene precio de Stripe configurado. Contactá a la administradora.",
        },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/c/${community.slug}/entrar?subscribed=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/c/${community.slug}/entrar`,
      metadata: {
        user_id: user.id,
        community_id: communityId,
        membership_id: membership.id,
      },
    });

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
      .select("*, subscriptions(*)")
      .eq("id", membershipId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
    }

    const subscription = Array.isArray(membership.subscriptions)
      ? membership.subscriptions[0]
      : membership.subscriptions;

    if (stripe && subscription?.stripe_subscription_id) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
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
