import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";
import { nanoid } from "nanoid";
import { internalErrorResponse, parseData, slugParamsSchema } from "@/lib/validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paramsResult = parseData(slugParamsSchema, await params);
    if ("error" in paramsResult) return paramsResult.error;
    const { slug } = paramsResult.data;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const community = await getCommunityBySlug(slug);
    if (!community) return NextResponse.json({ error: "Comunidad no encontrada" }, { status: 404 });

    const admin = await isCommunityAdmin(community.id, user.id, user.is_super_admin);
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const supabase = await createClient();
    const { data: invite, error } = await supabase
      .from("invites")
      .insert({
        community_id: community.id,
        created_by: user.id,
        token: nanoid(24),
      })
      .select()
      .single();

    if (error) return internalErrorResponse("Error al crear invitación:", error);
    return NextResponse.json({ invite });
  } catch (err) {
    return internalErrorResponse("POST /api/c/[slug]/invites failed:", err);
  }
}
