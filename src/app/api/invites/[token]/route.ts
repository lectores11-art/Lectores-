import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const serviceClient = await createServiceClient();

    const { data: invite, error } = await serviceClient
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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
