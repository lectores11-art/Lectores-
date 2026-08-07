import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import {
  internalErrorResponse,
  parseJsonBody,
  subscriptionPortalSchema,
} from "@/lib/validation";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json(
        {
          error:
            "Stripe no está configurado. Definí STRIPE_SECRET_KEY en el servidor (no hay portal demo).",
        },
        { status: 503 }
      );
    }

    const bodyResult = await parseJsonBody(request, subscriptionPortalSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { communityId } = bodyResult.data;

    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select(
        "id, community:communities(slug), subscriptions(stripe_customer_id, status)"
      )
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return internalErrorResponse(
        "Error al buscar membresía para portal:",
        membershipError
      );
    }
    if (!membership) {
      return NextResponse.json(
        { error: "Membresía no encontrada" },
        { status: 404 }
      );
    }

    const subscription = Array.isArray(membership.subscriptions)
      ? membership.subscriptions[0]
      : membership.subscriptions;

    const customerId = subscription?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "No hay un cliente de Stripe asociado a tu suscripción. Suscribite primero o contactá a la admin.",
        },
        { status: 400 }
      );
    }

    const community = Array.isArray(membership.community)
      ? membership.community[0]
      : membership.community;
    const slug = community?.slug;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = slug
      ? `${appUrl}/c/${slug}/settings`
      : `${appUrl}/dashboard`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe no devolvió la URL del portal." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (
      message.includes("no such customer") ||
      message.includes("billing portal") ||
      message.includes("portal configuration")
    ) {
      return NextResponse.json(
        {
          error:
            "No se pudo abrir el portal de Stripe. Revisá que el Customer Portal esté activado en el Dashboard de Stripe y que el customer exista.",
        },
        { status: 502 }
      );
    }
    return internalErrorResponse("POST /api/subscriptions/portal failed:", err);
  }
}
