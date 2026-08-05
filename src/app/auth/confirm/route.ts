import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Only allow internal, single-slash paths to avoid open-redirect attacks
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

// Handles Supabase email links (signup confirmation, invite, recovery).
// Templates should use token_hash, e.g.:
//   /auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
// PKCE flows may land with ?code= instead.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const failPath =
    type === "recovery" || next === "/update-password"
      ? "/forgot-password"
      : "/login?error=auth";
  return NextResponse.redirect(new URL(failPath, origin));
}
