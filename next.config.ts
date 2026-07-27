import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist; keep both out of the Turbopack bundle so the
  // worker resolves from node_modules at runtime (see Notion FIX-PDF task).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
