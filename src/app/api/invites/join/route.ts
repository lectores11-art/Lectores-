import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { internalErrorResponse, inviteJoinSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request, inviteJoinSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { token } = bodyResult.data;

    const serviceClient = await createServiceClient();

    const { data: invite, error: inviteError } = await serviceClient
      .from("invites")
      .select("*, community:communities(*)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invitación no válida" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitación expirada" }, { status: 410 });
    }

    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: "Límite de usos alcanzado" }, { status: 410 });
    }

    if (!invite.community) {
      return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: existing } = await serviceClient
      .from("memberships")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("community_id", invite.community_id)
      .single();

    if (existing?.status === "active") {
      return NextResponse.json({
        slug: invite.community.slug,
        message: "Ya eres miembro",
      });
    }

    if (existing) {
      await serviceClient
        .from("memberships")
        .update({ status: "active", joined_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await serviceClient.from("memberships").insert({
        user_id: user.id,
        community_id: invite.community_id,
        role: "member",
        status: "active",
        joined_at: new Date().toISOString(),
      });
    }

    await serviceClient
      .from("invites")
      .update({ use_count: invite.use_count + 1 })
      .eq("id", invite.id);

    return NextResponse.json({ slug: invite.community.slug });
  } catch (err) {
    return internalErrorResponse("POST /api/invites/join failed:", err);
  }
}
