import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommunityBySlug, getCurrentUser, isCommunityAdmin } from "@/lib/auth/helpers";
import { nanoid } from "nanoid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invite });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
