import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { platformFeePercent } from "@/lib/billing/platform-fee";
import { stripeAccountOptions } from "@/lib/billing/stripe-connect";
import { internalErrorResponse } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function syncPlatformFees() {
  if (!stripe) {
    return { ok: false as const, error: "Stripe no configurado" };
  }

  const service = await createServiceClient();
  const { data: subs, error: subError } = await service
    .from("subscriptions")
    .select("id, stripe_subscription_id, membership_id, status")
    .in("status", ["active", "trialing", "past_due"]);

  if (subError) {
    return { ok: false as const, error: subError.message };
  }

  const membershipIds = [...new Set((subs || []).map((row) => row.membership_id))];
  if (membershipIds.length === 0) {
    return { ok: true as const, updated: 0, skipped: 0 };
  }

  const { data: memberships, error: memError } = await service
    .from("memberships")
    .select("id, community_id")
    .in("id", membershipIds);

  if (memError) {
    return { ok: false as const, error: memError.message };
  }

  const communityIds = [
    ...new Set((memberships || []).map((row) => row.community_id)),
  ];
  const { data: communities, error: comError } = await service
    .from("communities")
    .select("id, stripe_account_id, stripe_charges_enabled, commission_starts_at")
    .in("id", communityIds);

  if (comError) {
    return { ok: false as const, error: comError.message };
  }

  const membershipById = new Map((memberships || []).map((row) => [row.id, row]));
  const communityById = new Map((communities || []).map((row) => [row.id, row]));

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of subs || []) {
    const membership = membershipById.get(row.membership_id);
    const club = membership ? communityById.get(membership.community_id) : undefined;
    if (
      !row.stripe_subscription_id ||
      !club?.stripe_account_id ||
      !club.stripe_charges_enabled
    ) {
      skipped += 1;
      continue;
    }

    const fee = platformFeePercent(
      club.commission_starts_at ?? new Date().toISOString()
    );
    try {
      await stripe.subscriptions.update(
        row.stripe_subscription_id,
        { application_fee_percent: fee },
        stripeAccountOptions(club.stripe_account_id)
      );
      updated += 1;
    } catch (err) {
      console.error("platform-fees: update failed", row.id, err);
      failed += 1;
    }
  }

  if (failed > 0) {
    return {
      ok: false as const,
      error: `Stripe falló en ${failed} suscripciones`,
      updated,
      skipped,
      failed,
    };
  }

  return { ok: true as const, updated, skipped, failed: 0 };
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const result = await syncPlatformFees();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return internalErrorResponse("GET /api/cron/platform-fees failed:", err);
  }
}

export const POST = GET;
