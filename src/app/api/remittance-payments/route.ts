import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { isHtmlPayload, messageForHtmlUpstream } from "@/lib/html-api-error";
import { getRemittanceApiUpstream } from "@/lib/remittance-api-upstream";

function gatewayBaseUrl(): string {
  return getRemittanceApiUpstream() || "http://localhost:9000";
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  if (isHtmlPayload(text)) {
    return {
      message: messageForHtmlUpstream(text),
      code: "UPSTREAM_HTML_ERROR",
    };
  }
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Proxies ops send-money: verifies the staff session, then creates a transfer
 * on behalf of the selected customer via POST /api/v1/admin/transfers.
 * Transfer-service pays out on Pegasus directly (remittance monolith
 * POST /remittance/payments) — no Cybrid or RytePay funding pull.
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
  const sendMoneyOtpToken =
    typeof o.send_money_otp_token === "string" ? o.send_money_otp_token.trim() : "";
  if (!userId || !payment || typeof payment !== "object" || Array.isArray(payment)) {
    return NextResponse.json(
      { message: "user_id and payment object are required", code: "VALIDATION" },
      { status: 400 },
    );
  }
  if (!sendMoneyOtpToken) {
    return NextResponse.json(
      {
        message: "Enter the authorization code emailed to info@borabond.com before sending money.",
        code: "SEND_MONEY_OTP_REQUIRED",
      },
      { status: 403 },
    );
  }

  const pay = asRecord(payment);
  const meta = asRecord(pay.metadata);
  const transferType = str(pay.transferType) === "bank" ? "bank" : "mobile_money";
  const amountSendMinor = num(pay.amountSend) ?? num(pay.amountSendMinor);
  if (!amountSendMinor || amountSendMinor < 1) {
    return NextResponse.json(
      { message: "payment.amountSend (USD cents) is required", code: "VALIDATION" },
      { status: 400 },
    );
  }

  const createBody = {
    customerUserId: userId,
    amountSendMinor,
    currencySend: str(pay.currencySend) || "USD",
    amountReceiveMinor: num(pay.amount) ?? num(pay.amountReceiveMinor) ?? num(pay.amountReceive),
    currencyReceive: str(pay.currencyReceive) || str(pay.currency) || "UGX",
    transferType,
    fundingMethod: str(pay.fundingMethod) || "bank",
    paymentType: str(pay.paymentType) === "collection" ? "collection" : "payout",
    recipientName: str(pay.recipientName),
    recipientPhone: str(pay.phoneNumber) || str(pay.recipientPhone),
    recipientAccount: str(pay.accountNumber) || str(pay.recipientAccount),
    recipientNetwork: str(pay.network) || str(pay.recipientNetwork),
    bankSortCode: str(pay.bankSortCode),
    bankCode: str(pay.bankCode),
    referenceId: str(pay.referenceId),
    narration: str(pay.narration),
    channel: str(pay.channel) || "web_app",
    initiatedBy: "ops_dashboard",
    deviceType: str(pay.deviceType) || "Web",
    userAgent: str(pay.userAgent),
    riskScore: num(pay.riskScore),
    riskLevel: str(pay.riskLevel),
    bondPercentage: num(meta.bondPercent) ?? num(pay.bondPercentage),
    idempotencyKey:
      str(pay.idempotencyKey) ||
      str(o.idempotencyKey) ||
      str(o.idempotency_key) ||
      `ops-send-${randomUUID()}`,
    sendMoneyOtpToken,
    recipientEntityType:
      str(pay.recipientEntityType) === "business" || str(meta.recipientEntityType) === "business"
        ? "business"
        : "individual",
  };

  const base = gatewayBaseUrl();
  const verifyRes = await fetch(`${base}/api/v1/admin/transfers/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!verifyRes.ok) {
    return NextResponse.json(
      { message: "Invalid or expired ops session", code: "ADMIN_AUTH_FAILED" },
      { status: 401 },
    );
  }

  const payRes = await fetch(`${base}/api/v1/admin/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": createBody.idempotencyKey,
    },
    body: JSON.stringify(createBody),
  });
  const raw = await parseJson(payRes);
  if (!payRes.ok) {
    return NextResponse.json(
      {
        message: pickMessage(raw, payRes.statusText || "Transfer failed"),
        code:
          raw && typeof raw === "object" && typeof (raw as { code?: string }).code === "string"
            ? (raw as { code: string }).code
            : `HTTP_${payRes.status}`,
      },
      { status: payRes.status },
    );
  }

  const outer = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const data = asRecord(outer.data);
  const transactionId =
    str(data.transactionId) ||
    str(data.id) ||
    str(data.platformTransactionId) ||
    str(outer.id);
  const status = str(data.status) || str(outer.status) || "INITIATED";
  if (!transactionId) {
    return NextResponse.json(
      { message: "Unexpected response from transfer-service", code: "BAD_UPSTREAM_SHAPE" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { transactionId, status },
  });
}
