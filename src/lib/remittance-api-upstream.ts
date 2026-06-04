/**
 * Server-only remittance API origin for proxy route handlers.
 * Do not use NEXT_PUBLIC_REMITTANCE_API_URL here — that is the browser-relative proxy path.
 */
const STAGING_UPSTREAM_DEFAULT = "https://staging-remittance.borabond.com";

export function getRemittanceApiUpstream(): string {
  const upstream = process.env.REMITTANCE_API_UPSTREAM?.trim();
  if (upstream && !upstream.startsWith("/")) {
    return upstream.replace(/\/$/, "");
  }

  const direct = process.env.REMITTANCE_API_URL?.trim();
  if (direct && !direct.startsWith("/")) {
    return direct.replace(/\/$/, "");
  }

  // Preview deploys (e.g. remittance-staging.borabond.com) often only have Production env in Vercel UI.
  if (process.env.VERCEL_ENV === "preview") {
    return STAGING_UPSTREAM_DEFAULT;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:9002";
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
