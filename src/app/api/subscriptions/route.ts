import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { communityId, priceId } = await request.json();
    if (!communityId) {
      return NextResponse.json({ error: "communityId requerido" }, { status: 400 });
    }

    if (!stripe) {
      return NextResponse.json({
        url: "/dashboard",
        demo: true,
        message: "Stripe no configurado - modo demo",
      });
    }

    const supabase = await createClient();
    const { data: community } = await supabase
      .from("communities")
      .select("*")
      .eq("id", communityId)
      .single();

    if (!community) {
      return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId || community.stripe_price_id || undefined,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/c/${community.slug}/forum?subscribed=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      metadata: {
        user_id: user.id,
        community_id: communityId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error de pago" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { membershipId } = await request.json();
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
}
