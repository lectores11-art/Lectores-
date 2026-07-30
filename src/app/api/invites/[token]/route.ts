import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { internalErrorResponse, inviteTokenParamsSchema, parseData } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const paramsResult = parseData(inviteTokenParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { token } = paramsResult.data;

    // service_role: invites SELECT by token no longer allowed under anon RLS (006).
    // Token is the capability secret — never list invites without it.
    const supabase = await createServiceClient();

    const { data: invite, error } = await supabase
      .from("invites")
      .select("*, community:communities(*)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invitación no válida o expirada" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Esta invitación ha expirado" }, { status: 410 });
    }

    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: "Esta invitación alcanzó el límite de usos" }, { status: 410 });
    }

    if (!invite.community) {
      return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ invite });
  } catch (err) {
    return internalErrorResponse("GET /api/invites/[token] failed:", err);
  }
}
