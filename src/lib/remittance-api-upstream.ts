/**
 * Server-only remittance API origin for proxy route handlers.
 * Do not use NEXT_PUBLIC_REMITTANCE_API_URL here — that is the browser-relative proxy path.
 */
export function getRemittanceApiUpstream(): string {
  const upstream = process.env.REMITTANCE_API_UPSTREAM?.trim();
  if (upstream && !upstream.startsWith("/")) {
    return upstream.replace(/\/$/, "");
  }

  const direct = process.env.REMITTANCE_API_URL?.trim();
  if (direct && !direct.startsWith("/")) {
    return direct.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:9002";
  }

  return "";
}
