/** Public site URL for redirects (Stripe return, Checkout, invite mail). */
export function getAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) {
    const host = prod.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return null;
}
