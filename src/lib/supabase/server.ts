import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-bound anon client — always subject to RLS. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}

/**
 * Bypasses RLS — use only for explicit server routes that document why.
 * See docs/SEGURIDAD.md § service_role.
 */
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL en las variables de entorno del servidor."
    );
  }
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (Production y Preview). Nombre exacto, sin NEXT_PUBLIC_."
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}
