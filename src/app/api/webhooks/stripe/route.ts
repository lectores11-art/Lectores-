import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ received: true, demo: true });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const communityId = session.metadata?.community_id;

    if (userId && communityId) {
      const { data: membership } = await serviceClient
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("community_id", communityId)
        .single();

      if (membership) {
        await serviceClient
          .from("memberships")
          .update({ status: "active" })
          .eq("id", membership.id);

        await serviceClient.from("subscriptions").upsert({
          membership_id: membership.id,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: "active",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
