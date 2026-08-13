/** True when an API response is an HTML page instead of JSON. */
export function isHtmlPayload(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("<!") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML")
  );
}

/**
 * Cloudflare / nginx HTML must never be shown in the dashboard UI.
 * 522 = origin (old remittance host) did not accept the TCP connection.
 */
export function messageForHtmlUpstream(text: string, upstreamHost?: string): string {
  const host = upstreamHost ? ` (${upstreamHost})` : "";
  if (/error code 522|522:\s*connection timed out/i.test(text)) {
    return `API origin timed out (Cloudflare 522)${host}. The dashboard must use the API gateway (staging-api.borabond.com / api.borabond.com), not staging-remittance.borabond.com.`;
  }
  if (/error code 524|524:\s*a timeout occurred/i.test(text)) {
    return `API origin timed out (Cloudflare 524)${host}. The gateway did not finish the request.`;
  }
  if (/error code 521|521:\s*web server is down/i.test(text)) {
    return `API origin is down (Cloudflare 521)${host}.`;
  }
  return `API returned an HTML error page instead of JSON${host}.`;
}
