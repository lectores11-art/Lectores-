import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isCommunityAdmin,
  requireApiCommunityAccess,
} from "@/lib/auth/helpers";
import {
  connectAccountIdempotencyKey,
  connectV2AccountCreateParams,
  connectV2AccountLinkCreateParams,
  publicConnectError,
} from "@/lib/billing/stripe-connect";
import { getAppUrl } from "@/lib/app-url";
import { parseData, slugParamsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
}

function connectFailure(err: unknown): NextResponse {
  console.error("stripe/connect:", err);
  return NextResponse.json(
    { error: publicConnectError(err) },
    { status: 500 }
  );
}

async function requireAdmin(slug: string) {
  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const admin = await isCommunityAdmin(
    access.community.id,
    access.user.id,
    access.user.is_super_admin
  );
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return access;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const auth = await requireAdmin(paramsResult.data.slug);
    if (auth instanceof NextResponse) return auth;
    const { community } = auth;

    return NextResponse.json({
      connected: Boolean(community.stripe_account_id),
      chargesEnabled: Boolean(community.stripe_charges_enabled),
    });
  } catch (err) {
    return connectFailure(err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const auth = await requireAdmin(paramsResult.data.slug);
    if (auth instanceof NextResponse) return auth;
    const { community } = auth;

    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no configurado. Definí STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    const appUrl = getAppUrl();
    if (!appUrl) {
      return NextResponse.json(
        { error: "Falta NEXT_PUBLIC_APP_URL." },
        { status: 500 }
      );
    }

    const service = await createServiceClient();
    let accountId = community.stripe_account_id;

    if (!accountId) {
      const { data: owner } = await service
        .from("profiles")
        .select("email")
        .eq("id", community.owner_id)
        .maybeSingle();

      const account = await stripe.v2.core.accounts.create(
        connectV2AccountCreateParams({
          communityId: community.id,
          communityName: community.name,
          ownerEmail: owner?.email,
        }),
        { idempotencyKey: connectAccountIdempotencyKey(community.id) }
      );
      accountId = account.id;
      const { error } = await service
        .from("communities")
        .update({ stripe_account_id: accountId })
        .eq("id", community.id);
      if (error) {
        return connectFailure(error);
      }
    }

    const link = await stripe.v2.core.accountLinks.create(
      connectV2AccountLinkCreateParams({
        accountId,
        refreshUrl: `${appUrl}/c/${community.slug}/admin?stripe=refresh`,
        returnUrl: `${appUrl}/c/${community.slug}/admin?stripe=return`,
      })
    );

    return NextResponse.json({ url: link.url });
  } catch (err) {
    return connectFailure(err);
  }
}
