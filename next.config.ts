import type { NextConfig } from "next";

/**
 * CSP hosts derived from real browser traffic in this app:
 * - Supabase Auth / REST / Realtime / Storage (covers + signed PDF URLs)
 * - LiveKit Cloud WebRTC signaling (NEXT_PUBLIC_LIVEKIT_URL)
 * - Classroom embeds: YouTube / Vimeo / Mux (admin-entered video_url)
 *
 * Deferred (not loaded in the browser today — document before enabling):
 * - Stripe.js (`js.stripe.com` / `api.stripe.com`): Checkout + Customer Portal
 *   are server redirects; `@stripe/stripe-js` is unused in client components.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next.js App Router still relies on inline/eval in this setup (no nonce pipeline yet).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.livekit.cloud",
    "wss://*.livekit.cloud",
  ].join(" "),
  [
    "frame-src 'self'",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    "https://stream.mux.com",
    "https://*.mux.com",
  ].join(" "),
  "media-src 'self' blob: https://*.supabase.co https://stream.mux.com https://*.mux.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist; keep both out of the Turbopack bundle so the
  // worker resolves from node_modules at runtime (see Notion FIX-PDF task).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
