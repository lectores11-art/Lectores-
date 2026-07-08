import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser, getOrCreateOwnerByEmail } from "@/lib/auth/helpers";
import { slugify } from "@/lib/utils";
import { nanoid } from "nanoid";

function apiError(error: unknown, fallback = "Error interno") {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error !== null) {
    const record = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return record.message || record.details || record.hint || record.code || fallback;
  }
  return fallback;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.is_super_admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, ownerEmail, monthlyPriceCents } = body;

    if (!name || !ownerEmail) {
      return NextResponse.json({ error: "Nombre y email de dueña requeridos" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();
    const ownerId = await getOrCreateOwnerByEmail(ownerEmail);

    const slug = `${slugify(name)}-${nanoid(6)}`;

    const { data: community, error: communityError } = await serviceClient
      .from("communities")
      .insert({
        name,
        slug,
        description: description || null,
        owner_id: ownerId,
        monthly_price_cents: monthlyPriceCents || 0,
        accent_color: "#0ea5e9",
      })
      .select()
      .single();

    if (communityError) {
      return NextResponse.json({ error: apiError(communityError) }, { status: 500 });
    }

    const { error: membershipError } = await serviceClient.from("memberships").insert({
      user_id: ownerId,
      community_id: community.id,
      role: "community_owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (membershipError) {
      await serviceClient.from("communities").delete().eq("id", community.id);
      return NextResponse.json({ error: apiError(membershipError) }, { status: 500 });
    }

    const { data: invite, error: inviteError } = await serviceClient
      .from("invites")
      .insert({
        community_id: community.id,
        created_by: ownerId,
      })
      .select()
      .single();

    if (inviteError) {
      return NextResponse.json({ error: apiError(inviteError) }, { status: 500 });
    }

    return NextResponse.json({ community, invite });
  } catch (err) {
    console.error("POST /api/platform/communities failed:", err);
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.is_super_admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: communities } = await supabase
    .from("communities")
    .select("*, invites(*)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ communities });
}
