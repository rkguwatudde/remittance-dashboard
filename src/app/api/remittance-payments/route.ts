import { NextRequest, NextResponse } from "next/server";

import { getRemittanceApiUpstream } from "@/lib/remittance-api-upstream";
import { parseJwtUserId, unwrapRemittancePaymentQueued } from "@/lib/remittance-payments-api";

function remittanceBackendBaseUrl(): string {
  return getRemittanceApiUpstream() || "http://localhost:9002";
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function pickMessage(raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Proxies POST /api/v1/remittance/payments: verifies ops session, mints a short-lived app-user JWT
 * via POST /api/v1/admins/send-money/app-user-access-token, then calls payments with that bearer.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized", code: "NO_ADMIN_TOKEN" }, { status: 401 });
  }
  const adminToken = authHeader.slice(7).trim();
  if (!adminToken) {
    return NextResponse.json({ message: "Unauthorized", code: "NO_ADMIN_TOKEN" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON", code: "BAD_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid body", code: "BAD_BODY" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const userId = typeof o.user_id === "string" ? o.user_id.trim() : "";
  const payment = o.payment;
  if (!userId || !payment || typeof payment !== "object" || Array.isArray(payment)) {
    return NextResponse.json(
      { message: "user_id and payment object are required", code: "VALIDATION" },
      { status: 400 },
    );
  }

  const base = remittanceBackendBaseUrl();
  const verifyRes = await fetch(`${base}/api/v1/admins/dashboard/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!verifyRes.ok) {
    return NextResponse.json(
      { message: "Invalid or expired ops session", code: "ADMIN_AUTH_FAILED" },
      { status: 401 },
    );
  }

  const tokRes = await fetch(`${base}/api/v1/admins/send-money/app-user-access-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const tokRaw = await parseJson(tokRes);
  if (!tokRes.ok) {
    const code =
      tokRaw && typeof tokRaw === "object" && typeof (tokRaw as { code?: string }).code === "string"
        ? (tokRaw as { code: string }).code
        : `HTTP_${tokRes.status}`;
    return NextResponse.json(
      {
        message: pickMessage(tokRaw, tokRes.statusText || "Could not mint app-user access token"),
        code,
        data: {
          steps: [
            "Ensure the remittance API is running and you use Super / Operations / Finance role.",
            "The selected sender must exist as an app user in the remittance database.",
            "Optional: set ADMIN_APP_USER_ACCESS_TOKEN_TTL on the API (default 15m).",
          ],
        },
      },
      { status: tokRes.status >= 400 && tokRes.status < 600 ? tokRes.status : 502 },
    );
  }

  const outer = tokRaw && typeof tokRaw === "object" ? (tokRaw as Record<string, unknown>) : null;
  const data = outer?.data;
  const access_token =
    data && typeof data === "object" && typeof (data as { access_token?: string }).access_token === "string"
      ? (data as { access_token: string }).access_token.trim()
      : "";
  if (!access_token) {
    return NextResponse.json(
      {
        message: "Remittance API returned no access_token for app user",
        code: "TOKEN_ISSUE_BAD_SHAPE",
        data: {
          steps: ["Check remittance API version includes POST /admins/send-money/app-user-access-token."],
        },
      },
      { status: 502 },
    );
  }

  if (parseJwtUserId(access_token) !== userId) {
    return NextResponse.json(
      { message: "Issued token subject does not match user_id", code: "TOKEN_ISSUE_MISMATCH" },
      { status: 500 },
    );
  }

  const payRes = await fetch(`${base}/api/v1/remittance/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payment),
  });

  const raw = await parseJson(payRes);

  if (!payRes.ok) {
    const msg = pickMessage(raw, payRes.statusText || "Payment failed");
    const code =
      raw && typeof raw === "object" && typeof (raw as { code?: string }).code === "string"
        ? (raw as { code: string }).code
        : `HTTP_${payRes.status}`;
    return NextResponse.json({ message: msg, code }, { status: payRes.status });
  }

  try {
    unwrapRemittancePaymentQueued(raw);
  } catch {
    return NextResponse.json(
      { message: "Unexpected response from remittance API", code: "BAD_UPSTREAM_SHAPE" },
      { status: 502 },
    );
  }

  return NextResponse.json(raw);
}
