import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/lib/types/database";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    case "incomplete":
    default:
      return "trialing";
  }
}

function periodIso(unix: number | null | undefined): string | null {
  if (unix == null || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString();
}

/** Stripe API 2025+: period lives on subscription items, not the subscription root. */
function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = subscription.items?.data?.[0];
  return {
    start: periodIso(item?.current_period_start),
    end: periodIso(item?.current_period_end),
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object" && "id" in fromParent) {
    return fromParent.id;
  }
  return null;
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function syncSubscriptionFromStripe(
  serviceClient: ServiceClient,
  subscription: Stripe.Subscription,
  extras?: { stripe_customer_id?: string | null }
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const period = subscriptionPeriod(subscription);
  const status = mapStripeSubscriptionStatus(subscription.status);
  const customerId =
    extras?.stripe_customer_id ??
    (typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer && "id" in subscription.customer
        ? subscription.customer.id
        : null);

  const patch: Record<string, unknown> = {
    status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_start: period.start,
    current_period_end: period.end,
    updated_at: new Date().toISOString(),
  };
  if (customerId) {
    patch.stripe_customer_id = customerId;
  }

  const { error } = await serviceClient
    .from("subscriptions")
    .update(patch)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Stripe webhook: subscription sync failed:", error);
    return { ok: false, error };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe no configurado" },
      { status: 503 }
    );
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

  // service_role: Stripe webhooks have no user session; must update memberships/subscriptions.
  // Billing sync only — community access remains gated by membership, not paid status.
  const serviceClient = await createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const communityId = session.metadata?.community_id;

        if (userId && communityId) {
          const { data: membership, error: membershipError } = await serviceClient
            .from("memberships")
            .select("id")
            .eq("user_id", userId)
            .eq("community_id", communityId)
            .maybeSingle();

          if (membershipError) {
            console.error("Stripe webhook: membership lookup failed:", membershipError);
            return NextResponse.json({ error: "Sync falló" }, { status: 500 });
          }

          if (membership) {
            const { error: activateError } = await serviceClient
              .from("memberships")
              .update({ status: "active" })
              .eq("id", membership.id);

            if (activateError) {
              console.error("Stripe webhook: activate membership failed:", activateError);
              return NextResponse.json({ error: "Sync falló" }, { status: 500 });
            }

            const stripeSubscriptionId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;

            const { error: upsertError } = await serviceClient
              .from("subscriptions")
              .upsert({
                membership_id: membership.id,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: stripeSubscriptionId,
                status: "active",
              });

            if (upsertError) {
              console.error("Stripe webhook: subscription upsert failed:", upsertError);
              return NextResponse.json({ error: "Sync falló" }, { status: 500 });
            }

            if (stripeSubscriptionId) {
              const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              const synced = await syncSubscriptionFromStripe(serviceClient, sub, {
                stripe_customer_id: session.customer as string,
              });
              if (!synced.ok) {
                return NextResponse.json({ error: "Sync falló" }, { status: 500 });
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const synced = await syncSubscriptionFromStripe(serviceClient, subscription);
        if (!synced.ok) {
          return NextResponse.json({ error: "Sync falló" }, { status: 500 });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const period = subscriptionPeriod(subscription);
        const { error } = await serviceClient
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancel_at_period_end: false,
            current_period_start: period.start,
            current_period_end: period.end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Stripe webhook: subscription deleted sync failed:", error);
          return NextResponse.json({ error: "Sync falló" }, { status: 500 });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoiceSubscriptionId(invoice);

        if (stripeSubscriptionId) {
          const { error } = await serviceClient
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", stripeSubscriptionId);

          if (error) {
            console.error("Stripe webhook: payment_failed sync failed:", error);
            return NextResponse.json({ error: "Sync falló" }, { status: 500 });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    return NextResponse.json({ error: "Sync falló" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
