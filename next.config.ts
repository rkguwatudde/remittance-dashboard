import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * When set (e.g. in production), `/api/remittance-backend/*` is proxied to this host.
 * Use with NEXT_PUBLIC_REMITTANCE_API_URL=/api/remittance-backend so the browser stays
 * same-origin and avoids broken duplicate Access-Control-Allow-Origin from CDN/nginx + API.
 */
const remittanceApiUpstream = process.env.REMITTANCE_API_UPSTREAM?.trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Parent workspace (`main-app`) — avoids Next inferring the wrong root when multiple lockfiles exist. */
  outputFileTracingRoot: path.join(__dirname, ".."),
  async rewrites() {
    if (!remittanceApiUpstream) return [];
    const base = remittanceApiUpstream.replace(/\/$/, "");
    return [
      {
        source: "/api/remittance-backend/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
