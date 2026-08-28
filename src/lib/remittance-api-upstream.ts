/**
 * Server-only API gateway origin for proxy route handlers.
 * Do not use NEXT_PUBLIC_REMITTANCE_API_URL here — that is the browser-relative proxy path.
 */
const STAGING_UPSTREAM_DEFAULT = "https://staging-api.borabond.com";
const PRODUCTION_UPSTREAM_DEFAULT = "https://core-api.borabond.com";

/**
 * Old remittance Nest (:9002) hosts. Cloudflare 522s because that origin is down.
 * Admin APIs now live on the API gateway (:9000).
 */
const DEPRECATED_REMITTANCE_ORIGINS: Record<string, string> = {
  "staging-remittance.borabond.com": STAGING_UPSTREAM_DEFAULT,
  "www.staging-remittance.borabond.com": STAGING_UPSTREAM_DEFAULT,
  "remittance.api.borabond.com": PRODUCTION_UPSTREAM_DEFAULT,
};

export function rewriteDeprecatedApiOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return DEPRECATED_REMITTANCE_ORIGINS[host] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function getRemittanceApiUpstream(): string {
  const upstream = process.env.REMITTANCE_API_UPSTREAM?.trim();
  if (upstream && !upstream.startsWith("/")) {
    return rewriteDeprecatedApiOrigin(upstream);
  }

  const direct = process.env.REMITTANCE_API_URL?.trim();
  if (direct && !direct.startsWith("/")) {
    return rewriteDeprecatedApiOrigin(direct);
  }

  // Preview deploys (e.g. remittance-staging.borabond.com) often only have Production env in Vercel UI.
  if (process.env.VERCEL_ENV === "preview") {
    return STAGING_UPSTREAM_DEFAULT;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:9000";
  }

  return "";
}

/** Safe label for diagnostics (no secrets). */
export function getRemittanceApiUpstreamLabel(): string {
  const base = getRemittanceApiUpstream();
  if (!base) return "(not configured)";
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}
