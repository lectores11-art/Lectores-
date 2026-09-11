import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { accountLegalSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (user.deleted_at) {
    return NextResponse.json({ error: "Cuenta eliminada" }, { status: 403 });
  }

  const bodyResult = await parseJsonBody(request, accountLegalSchema);
  if ("error" in bodyResult) return bodyResult.error;

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      residence_country: bodyResult.data.residenceCountry,
      accepted_terms_at: now,
      accepted_privacy_at: now,
      age_attested_at: now,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
