import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCommunityAdmin, requireApiCommunityAccess } from "@/lib/auth/helpers";
import { stripeAccountOptions } from "@/lib/billing/stripe-connect";
import {
  internalErrorResponse,
  membershipParamsSchema,
  membershipStatusPatchSchema,
  parseData,
  parseJsonBody,
} from "@/lib/validation";

const OWNER_KICK_MESSAGE = "No podés expulsar a la dueña de la comunidad.";
const SELF_KICK_MESSAGE = "No podés expulsarte a vos misma desde aquí.";
const STRIPE_KICK_FAIL_MESSAGE =
  "No se pudo cancelar el cobro en Stripe. No expulsamos al miembro; intentá de nuevo o revisá el Dashboard.";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Fail-closed billing cancel before soft-kick.
 * If there is a stripe_subscription_id and cancel cannot be confirmed, returns an error response.
 */
async function cancelStripeBeforeKick(
  membershipId: string,
  stripeAccountId?: string | null
): Promise<{ error: NextResponse } | { ok: true }> {
  const serviceClient = await createServiceClient();
  const { data: subscription, error } = await serviceClient
    .from("subscriptions")
    .select("id, stripe_subscription_id, status")
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (error) {
    console.error("Kick: lookup subscription failed:", error);
    return {
      error: NextResponse.json(
        { error: STRIPE_KICK_FAIL_MESSAGE },
        { status: 503 }
      ),
    };
  }

  const stripeSubId = subscription?.stripe_subscription_id;
  if (!stripeSubId) {
    return { ok: true };
  }

  if (!stripe) {
    return {
      error: NextResponse.json(
        { error: STRIPE_KICK_FAIL_MESSAGE },
        { status: 503 }
      ),
    };
  }

  try {
    await stripe.subscriptions.update(
      stripeSubId,
      { cancel_at_period_end: true },
      stripeAccountOptions(stripeAccountId)
    );
  } catch (err) {
    console.error("Kick: Stripe cancel failed:", err);
    return {
      error: NextResponse.json(
        { error: STRIPE_KICK_FAIL_MESSAGE },
        { status: 503 }
      ),
    };
  }

  const { error: updateError } = await serviceClient
    .from("subscriptions")
    .update({ cancel_at_period_end: true, status: "cancelled" })
    .eq("id", subscription!.id);

  if (updateError) {
    console.error("Kick: local subscription update failed:", updateError);
    return {
      error: NextResponse.json(
        { error: STRIPE_KICK_FAIL_MESSAGE },
        { status: 503 }
      ),
    };
  }

  return { ok: true };
}

async function deactivateMembership(
  slug: string,
  membershipId: string,
  nextStatus: "cancelled"
) {
  const access = await requireApiCommunityAccess(slug);
  if (access instanceof NextResponse) return access;
  const { user, community } = access;

  const admin = await isCommunityAdmin(
    community.id,
    user.id,
    user.is_super_admin
  );
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: target, error: fetchError } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("id", membershipId)
    .eq("community_id", community.id)
    .maybeSingle();

  if (fetchError) {
    return internalErrorResponse("Error al buscar membresía:", fetchError);
  }
  if (!target) {
    return NextResponse.json(
      { error: "Membresía no encontrada" },
      { status: 404 }
    );
  }

  if (target.user_id === user.id) {
    return NextResponse.json({ error: SELF_KICK_MESSAGE }, { status: 403 });
  }

  const isOwner =
    target.user_id === community.owner_id ||
    target.role === "community_owner";
  if (isOwner) {
    return NextResponse.json({ error: OWNER_KICK_MESSAGE }, { status: 403 });
  }

  // Soft-deactivate only — never delete auth.users.
  // Kick always sets rejoin_blocked so invite cannot reactivate membership.
  if (target.status !== "active") {
    const { data: ensured, error: ensureError } = await supabase
      .from("memberships")
      .update({ rejoin_blocked: true })
      .eq("id", target.id)
      .eq("community_id", community.id)
      .select("id, user_id, role, status, rejoin_blocked, joined_at, created_at")
      .single();

    if (ensureError) {
      return internalErrorResponse(
        "Error al bloquear reingreso de membresía:",
        ensureError
      );
    }

    return NextResponse.json({
      success: true,
      membership: ensured ?? { id: target.id, status: target.status },
    });
  }

  // Fail-closed: never soft-kick if Stripe cancel cannot be confirmed.
  const billing = await cancelStripeBeforeKick(
    target.id,
    community.stripe_account_id
  );
  if ("error" in billing) return billing.error;

  // Soft-deactivate only — never delete auth.users.
  // Kick always sets rejoin_blocked so invite cannot reactivate membership.
  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update({ status: nextStatus, rejoin_blocked: true })
    .eq("id", target.id)
    .eq("community_id", community.id)
    .select("id, user_id, role, status, rejoin_blocked, joined_at, created_at")
    .single();

  if (updateError) {
    return internalErrorResponse("Error al desactivar membresía:", updateError);
  }

  return NextResponse.json({
    success: true,
    membership: updated,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; membershipId: string }> }
) {
  try {
    const paramsResult = parseData(membershipParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, membershipId } = paramsResult.data;

    const bodyResult = await parseJsonBody(request, membershipStatusPatchSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { status } = bodyResult.data;

    return deactivateMembership(slug, membershipId, status);
  } catch (err) {
    return internalErrorResponse(
      "PATCH /api/c/[slug]/members/[membershipId] failed:",
      err
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; membershipId: string }> }
) {
  try {
    const paramsResult = parseData(membershipParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug, membershipId } = paramsResult.data;

    return deactivateMembership(slug, membershipId, "cancelled");
  } catch (err) {
    return internalErrorResponse(
      "DELETE /api/c/[slug]/members/[membershipId] failed:",
      err
    );
  }
}
