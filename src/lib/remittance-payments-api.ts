/**
 * End-user remittance API — same path as the mobile app (`/api/v1/remittance/payments`).
 * Requires the sender's app JWT (AuthGuard jwt), not the ops admin token.
 */

import { AdminApiError } from "@/lib/remittance-admin-api";

const baseUrl = () =>
  (process.env.NEXT_PUBLIC_REMITTANCE_API_URL || "http://localhost:9002").replace(/\/$/, "");

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function parseApiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string" && m) return m;
  if (Array.isArray(m)) {
    return m.map((x) => (typeof x === "object" && x ? JSON.stringify(x) : String(x))).join("; ") || fallback;
  }
  return fallback;
}

/** Rich errors from `/api/remittance-payments` (structured `data.steps`). */
function formatDashboardProxyError(body: unknown, fallback: string): string {
  const base = parseApiMessage(body, fallback);
  if (!body || typeof body !== "object") return base;
  const data = (body as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return base;
  const steps = (data as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return base;
  const lines = steps
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!lines.length) return base;
  return `${base}\n\n${lines.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

export function parseJwtUserId(token: string): string | null {
  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
    const sub = json.sub ?? json.id ?? json.userId;
    return typeof sub === "string" ? sub.trim() : null;
  } catch {
    return null;
  }
}

export type RemittancePaymentQueued = {
  transactionId: string;
  status: string;
};

export function unwrapRemittancePaymentQueued(raw: unknown): RemittancePaymentQueued {
  const outer = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const inner = outer?.data;
  if (inner && typeof inner === "object") {
    const d = inner as Record<string, unknown>;
    const tid = d.transactionId;
    const st = d.status;
    if (tid != null && (typeof tid === "string" || typeof tid === "number")) {
      return {
        transactionId: String(tid),
        status: typeof st === "string" ? st : "PROCESSING",
      };
    }
  }
  throw new AdminApiError("Unexpected payments response shape", "BAD_RESPONSE", 500);
}

/** Direct to remittance API (mobile app path). Prefer {@link postRemittancePaymentsViaDashboardProxy} from the ops dashboard. */
export async function postRemittancePayments(
  userAccessToken: string,
  body: Record<string, unknown>,
): Promise<RemittancePaymentQueued> {
  const url = `${baseUrl()}/api/v1/remittance/payments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userAccessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await parseJson(res);

  if (!res.ok) {
    const code =
      raw && typeof raw === "object" && typeof (raw as { code?: string }).code === "string"
        ? (raw as { code: string }).code
        : `HTTP_${res.status}`;
    throw new AdminApiError(parseApiMessage(raw, res.statusText || "Payment failed"), code, res.status);
  }

  return unwrapRemittancePaymentQueued(raw);
}

/**
 * Dashboard-only: same-origin `/api/remittance-payments` uses the server env map + ops session; no app JWT on the client.
 */
export async function postRemittancePaymentsViaDashboardProxy(
  adminAccessToken: string,
  userId: string,
  payment: Record<string, unknown>,
): Promise<RemittancePaymentQueued> {
  const res = await fetch("/api/remittance-payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminAccessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId.trim(), payment }),
  });
  const raw = await parseJson(res);

  if (!res.ok) {
    const code =
      raw && typeof raw === "object" && typeof (raw as { code?: string }).code === "string"
        ? (raw as { code: string }).code
        : `HTTP_${res.status}`;
    throw new AdminApiError(
      formatDashboardProxyError(raw, res.statusText || "Payment failed"),
      code,
      res.status,
    );
  }

  return unwrapRemittancePaymentQueued(raw);
}
