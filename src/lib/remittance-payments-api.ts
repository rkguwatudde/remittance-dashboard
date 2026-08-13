/**
 * Ops send-money: same-origin `/api/remittance-payments` → API gateway
 * `POST /api/v1/admin/transfers` (staff JWT only — no customer impersonation).
 */

import { AdminApiError } from "@/lib/remittance-admin-api";

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

/**
 * Dashboard-only: same-origin `/api/remittance-payments` uses the staff session.
 * The Next.js route forwards to the API gateway; the browser never talks to a customer API.
 */
export async function postRemittancePaymentsViaDashboardProxy(
  adminAccessToken: string,
  userId: string,
  payment: Record<string, unknown>,
  sendMoneyOtpToken: string,
): Promise<RemittancePaymentQueued> {
  const res = await fetch("/api/remittance-payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminAccessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId.trim(),
      payment,
      send_money_otp_token: sendMoneyOtpToken.trim(),
    }),
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
