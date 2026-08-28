import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import {
  isCommunityAdmin,
  requireApiCommunityAccess,
} from "@/lib/auth/helpers";
import { connectAccountIdempotencyKey } from "@/lib/billing/stripe-connect";
import { internalErrorResponse, parseData, slugParamsSchema } from "@/lib/validation";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no configurado. Definí STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    if (!community.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        chargesEnabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(community.stripe_account_id);
    const chargesEnabled = Boolean(account.charges_enabled);
    const service = await createServiceClient();
    await service
      .from("communities")
      .update({ stripe_charges_enabled: chargesEnabled })
      .eq("id", community.id);

    return NextResponse.json({
      connected: true,
      chargesEnabled,
    });
  } catch (err) {
    return internalErrorResponse("GET /api/c/[slug]/stripe/connect failed:", err);
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

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe no configurado. Definí STRIPE_SECRET_KEY." },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
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

      const account = await stripe.accounts.create(
        {
          type: "standard",
          country: "ES",
          email: owner?.email ?? undefined,
          metadata: { community_id: community.id },
        },
        { idempotencyKey: connectAccountIdempotencyKey(community.id) }
      );
      accountId = account.id;
      const { error } = await service
        .from("communities")
        .update({ stripe_account_id: accountId })
        .eq("id", community.id);
      if (error) {
        return internalErrorResponse("Error al guardar la cuenta Stripe:", error);
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/c/${community.slug}/admin?stripe=refresh`,
      return_url: `${appUrl}/c/${community.slug}/admin?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    return internalErrorResponse(
      "POST /api/c/[slug]/stripe/connect failed:",
      err
    );
  }
}
