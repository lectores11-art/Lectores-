import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { internalErrorResponse, inviteJoinSchema, parseJsonBody } from "@/lib/validation";

type AcceptInviteResult = {
  community_slug: string;
  already_member: boolean;
};

export async function POST(request: Request) {
  try {
    const bodyResult = await parseJsonBody(request, inviteJoinSchema);
    if ("error" in bodyResult) return bodyResult.error;
    const { token } = bodyResult.data;

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // SECURITY DEFINER: validates token, inserts/activates membership as role=member,
    // bumps use_count. Replaces open memberships INSERT policy removed in 006.
    const { data: results, error } = await supabase.rpc("accept_invite", {
      p_token: token,
    });

    if (error) {
      const message = (error.message || "").toLowerCase();
      if (message.includes("invalid invite")) {
        return NextResponse.json({ error: "Invitación no válida" }, { status: 404 });
      }
      if (message.includes("expired")) {
        return NextResponse.json({ error: "Invitación expirada" }, { status: 410 });
      }
      if (message.includes("max uses")) {
        return NextResponse.json({ error: "Límite de usos alcanzado" }, { status: 410 });
      }
      if (message.includes("not authenticated")) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      if (message.includes("community not found")) {
        return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
      }
      return internalErrorResponse("Error al aceptar invitación:", error);
    }

    const row = (Array.isArray(results) ? results[0] : results) as
      | AcceptInviteResult
      | undefined;

    if (!row?.community_slug) {
      return NextResponse.json({ error: "Invitación no válida" }, { status: 404 });
    }

    if (row.already_member) {
      return NextResponse.json({
        slug: row.community_slug,
        message: "Ya eres miembro",
      });
    }

    return NextResponse.json({ slug: row.community_slug });
  } catch (err) {
    return internalErrorResponse("POST /api/invites/join failed:", err);
  }
}
