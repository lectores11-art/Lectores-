import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import type { MembershipStatus, SubscriptionStatus } from "@/lib/types/database";
import {
  joinedAtOnActivate,
  membershipStatusAfterStripeEvent,
  shouldActivateFromCheckout,
} from "@/lib/billing/stripe-access";
import {
  connectedAccountFromEvent,
  stripeAccountOptions,
} from "@/lib/billing/stripe-connect";

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

async function applyMembershipStatusById(
  serviceClient: ServiceClient,
  membershipId: string,
  status: MembershipStatus,
  options?: { setJoinedAt?: boolean }
): Promise<{ ok: true } | { ok: false }> {
  const { data: membership, error: lookupError } = await serviceClient
    .from("memberships")
    .select("id, joined_at, rejoin_blocked")
    .eq("id", membershipId)
    .maybeSingle();

  if (lookupError) {
    console.error("Stripe webhook: membership lookup failed:", lookupError);
    return { ok: false };
  }
  if (!membership) return { ok: true };
  if (membership.rejoin_blocked) {
    console.error(
      "Stripe webhook: refusing to change rejoin_blocked membership",
      membership.id
    );
    return { ok: true };
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (options?.setJoinedAt && status === "active") {
    patch.joined_at = joinedAtOnActivate(
      membership.joined_at,
      new Date().toISOString()
    );
  }

  const { error } = await serviceClient
    .from("memberships")
    .update(patch)
    .eq("id", membership.id);

  if (error) {
    console.error("Stripe webhook: membership status update failed:", error);
    return { ok: false };
  }
  return { ok: true };
}

async function applyMembershipStatusForStripeSubscription(
  serviceClient: ServiceClient,
  stripeSubscriptionId: string,
  status: MembershipStatus | "unchanged"
): Promise<{ ok: true } | { ok: false }> {
  if (status === "unchanged") return { ok: true };

  const { data: subscription, error } = await serviceClient
    .from("subscriptions")
    .select("membership_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    console.error("Stripe webhook: subscription membership lookup failed:", error);
    return { ok: false };
  }
  if (!subscription?.membership_id) return { ok: true };

  return applyMembershipStatusById(serviceClient, subscription.membership_id, status, {
    setJoinedAt: status === "active",
  });
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

  // service_role: Stripe webhooks have no user session. Paid subscription opens access.
  const serviceClient = await createServiceClient();
  const connectedAccount = connectedAccountFromEvent(event);
  const accountOpts = stripeAccountOptions(connectedAccount);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const communityId = session.metadata?.community_id;

        if (userId && communityId) {
          const metadataMembershipId = session.metadata?.membership_id;
          let membershipQuery = serviceClient
            .from("memberships")
            .select("id, status, rejoin_blocked")
            .eq("user_id", userId)
            .eq("community_id", communityId);

          if (metadataMembershipId) {
            membershipQuery = membershipQuery.eq("id", metadataMembershipId);
          }

          const { data: membership, error: membershipError } =
            await membershipQuery.maybeSingle();

          if (membershipError) {
            console.error("Stripe webhook: membership lookup failed:", membershipError);
            return NextResponse.json({ error: "Sync falló" }, { status: 500 });
          }

          if (membership?.rejoin_blocked) {
            console.error(
              "Stripe webhook: refusing to activate rejoin_blocked membership",
              membership.id
            );
            return NextResponse.json({
              received: true,
              skipped: "rejoin_blocked",
            });
          }

          if (membership) {
            const stripeSubscriptionId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;
            const paid = shouldActivateFromCheckout(session.payment_status);

            const { error: upsertError } = await serviceClient
              .from("subscriptions")
              .upsert(
                {
                  membership_id: membership.id,
                  stripe_customer_id: session.customer as string,
                  stripe_subscription_id: stripeSubscriptionId,
                  status: paid ? "active" : "trialing",
                },
                { onConflict: "membership_id" }
              );

            if (upsertError) {
              console.error("Stripe webhook: subscription upsert failed:", upsertError);
              return NextResponse.json({ error: "Sync falló" }, { status: 500 });
            }

            if (paid) {
              const nextStatus = membershipStatusAfterStripeEvent({
                type: "checkout.session.completed",
              });
              if (nextStatus !== "unchanged") {
                const activated = await applyMembershipStatusById(
                  serviceClient,
                  membership.id,
                  nextStatus,
                  { setJoinedAt: true }
                );
                if (!activated.ok) {
                  return NextResponse.json({ error: "Sync falló" }, { status: 500 });
                }
              }
            }

            if (stripeSubscriptionId) {
              const sub = await stripe.subscriptions.retrieve(
                stripeSubscriptionId,
                {},
                accountOpts
              );
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
        const membershipStatus = membershipStatusAfterStripeEvent({
          type: "customer.subscription.updated",
          stripeStatus: subscription.status,
        });
        const applied = await applyMembershipStatusForStripeSubscription(
          serviceClient,
          subscription.id,
          membershipStatus
        );
        if (!applied.ok) {
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

        const locked = await applyMembershipStatusForStripeSubscription(
          serviceClient,
          subscription.id,
          membershipStatusAfterStripeEvent({ type: "customer.subscription.deleted" })
        );
        if (!locked.ok) {
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

          const locked = await applyMembershipStatusForStripeSubscription(
            serviceClient,
            stripeSubscriptionId,
            membershipStatusAfterStripeEvent({ type: "invoice.payment_failed" })
          );
          if (!locked.ok) {
            return NextResponse.json({ error: "Sync falló" }, { status: 500 });
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.id) {
          const { error } = await serviceClient
            .from("communities")
            .update({
              stripe_charges_enabled: Boolean(account.charges_enabled),
            })
            .eq("stripe_account_id", account.id);
          if (error) {
            console.error("Stripe webhook: account.updated sync failed:", error);
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
