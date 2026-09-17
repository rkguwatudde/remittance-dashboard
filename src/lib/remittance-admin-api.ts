/**
 * Platform admin API via the API gateway (`/api/v1/admin/{domain}/*`).
 *
 * Browser always uses the same-origin proxy. Absolute NEXT_PUBLIC values
 * (including the retired staging-remittance.borabond.com host) are ignored
 * so Cloudflare HTML error pages never hit the UI.
 */

import { isHtmlPayload, messageForHtmlUpstream } from "@/lib/html-api-error";

const SAME_ORIGIN_PROXY = "/api/remittance-backend";

const baseUrl = () => {
  const raw = (process.env.NEXT_PUBLIC_REMITTANCE_API_URL || SAME_ORIGIN_PROXY).replace(
    /\/$/,
    "",
  );
  if (!raw || raw.startsWith("/")) return raw || SAME_ORIGIN_PROXY;
  return SAME_ORIGIN_PROXY;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function parseApiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string" && m) {
    return isHtmlPayload(m) ? messageForHtmlUpstream(m) : m;
  }
  if (Array.isArray(m)) {
    const parts = m.map((x) =>
      typeof x === "object" && x && "constraints" in x
        ? JSON.stringify(x)
        : String(x),
    );
    return parts.join("; ") || fallback;
  }
  return fallback;
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

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const headers: HeadersInit = {
    ...(init?.headers as Record<string, string>),
  };
  let body: string | undefined;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, body, headers });
  const data = await parseJson(res);

  if (!res.ok) {
    const msg = parseApiMessage(data, res.statusText || "Request failed");
    const code =
      data && typeof data === "object" && typeof (data as { code?: string }).code === "string"
        ? (data as { code: string }).code
        : `HTTP_${res.status}`;
    throw new AdminApiError(msg, code, res.status);
  }

  return data as T;
}

export type AdminLoginStep1Response = {
  success: boolean;
  requires_2fa: boolean;
  status: string;
  session_id: string;
  password_reset_required?: boolean;
};

export type AdminVerifyOtpResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  admin: { id: string; email: string; role: string };
  password_reset_required?: boolean;
};

export type AdminRefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  admin: { id: string; email: string; role: string };
  password_reset_required?: boolean;
};

export async function adminLogin(email: string, password: string) {
  return request<AdminLoginStep1Response>("/api/v1/admin/auth/login", {
    method: "POST",
    json: { email, password },
  });
}

export async function adminVerifyOtp(session_id: string, otp: string) {
  const raw = await request<AdminVerifyOtpResponse & { staff?: AdminVerifyOtpResponse["admin"] }>(
    "/api/v1/admin/auth/verify-otp",
    {
      method: "POST",
      json: { session_id, otp },
    },
  );
  const admin = raw.admin ?? raw.staff;
  if (!admin) {
    throw new AdminApiError("Login succeeded but no staff profile was returned", "BAD_RESPONSE", 502);
  }
  return { ...raw, admin };
}

export async function adminSendMoneyOtpChallenge(accessToken: string) {
  const raw = await request<{
    success: boolean;
    data: { challenge_id: string; expires_in_sec: number; destination_email: string };
  }>("/api/v1/admin/auth/send-money-otp/challenge", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export async function adminSendMoneyOtpVerify(
  accessToken: string,
  challengeId: string,
  otp: string,
) {
  const raw = await request<{
    success: boolean;
    data: { confirmation_token: string; expires_in_sec: number };
  }>("/api/v1/admin/auth/send-money-otp/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { challenge_id: challengeId, otp },
  });
  return raw.data;
}

export async function adminForgotPassword(email: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admin/auth/forgot-password",
    { method: "POST", json: { email } },
  );
}

export async function adminResetPassword(token: string, new_password: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admin/auth/reset-password",
    { method: "POST", json: { token, new_password } },
  );
}

export async function adminRefresh(refresh_token: string) {
  const raw = await request<AdminRefreshResponse & { staff?: AdminRefreshResponse["admin"] }>(
    "/api/v1/admin/auth/refresh",
    {
      method: "POST",
      json: { refresh_token },
    },
  );
  const admin = raw.admin ?? raw.staff;
  if (!admin) {
    throw new AdminApiError("Refresh succeeded but no staff profile was returned", "BAD_RESPONSE", 502);
  }
  return { ...raw, admin };
}

export async function adminLogout(accessToken: string, refresh_token?: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admin/auth/logout",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: refresh_token ? { refresh_token } : {},
    },
  );
}

export async function adminChangePassword(
  accessToken: string,
  current_password: string,
  new_password: string,
) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admin/auth/change-password",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: { current_password, new_password },
    },
  );
}

export async function adminUpdateSignIn(
  accessToken: string,
  existing: string,
  next: string,
) {
  return adminChangePassword(accessToken, existing, next);
}

/** Super-admin team management: GET/POST /api/v1/admin/staff */
export type AdminTeamMember = {
  id: string;
  email: string;
  role: string;
  isActive?: boolean;
  is_active?: boolean;
  mustResetPassword?: boolean;
  must_reset_password?: boolean;
  is_locked?: boolean;
  locked_until?: string | null;
  is_online?: boolean;
  last_login_at?: string | null;
  last_seen_at?: string | null;
  last_login_ip?: string | null;
  last_login_user_agent?: string | null;
  last_seen_ip?: string | null;
  last_seen_user_agent?: string | null;
  active_refresh_sessions?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  createdByAdminId?: string | null;
  created_by_admin_id?: string | null;
  created_by_staff_id?: string | null;
};

export type AdminStaffActivityRow = {
  id: string;
  created_at: string | null;
  staff_id: string | null;
  staff_email: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata_preview: string | null;
};

export type AdminStaffMonitorSummary = {
  total: number;
  active: number;
  disabled: number;
  locked: number;
  online: number;
  offline: number;
  never_signed_in: number;
  must_reset_password: number;
};

export type AdminStaffMonitorResponse = {
  generated_at: string;
  online_threshold_seconds: number;
  summary: AdminStaffMonitorSummary;
  admins: AdminTeamMember[];
  recent_activity: AdminStaffActivityRow[];
};

export const ADMIN_CREATE_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
] as const;

export async function adminListTeam(accessToken: string) {
  const raw = await request<{ success: boolean; data: { admins: AdminTeamMember[] } }>(
    "/api/v1/admin/staff",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.admins;
}

export async function adminStaffMonitor(accessToken: string) {
  const raw = await request<{ success: boolean; data: AdminStaffMonitorResponse }>(
    "/api/v1/admin/staff/monitor",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminStaffHeartbeat(accessToken: string) {
  return request<{ success: boolean; data: { last_seen_at: string | null } }>(
    "/api/v1/admin/auth/heartbeat",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function adminRevokeStaffSessions(accessToken: string, staffId: string) {
  const raw = await request<{
    success: boolean;
    message: string;
    data: { staff_id: string; email: string };
  }>(`/api/v1/admin/staff/${encodeURIComponent(staffId)}/revoke-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw;
}

export async function adminCreateTeamMember(
  accessToken: string,
  body: { email: string; role: (typeof ADMIN_CREATE_ROLES)[number] },
) {
  const raw = await request<{
    success: boolean;
    message: string;
    data: {
      id: string;
      email: string;
      role: string;
      onboarding_email_sent: boolean;
    };
  }>("/api/v1/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { email: body.email.trim().toLowerCase(), role: body.role },
  });
  return { ...raw.data, message: raw.message };
}

export async function adminUpdateTeamMember(
  accessToken: string,
  id: string,
  body: { is_active: boolean },
) {
  const raw = await request<{
    success: boolean;
    message: string;
    data: { admin: { id: string; email: string; role: string; is_active: boolean } };
  }>(`/api/v1/admin/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return raw.data.admin;
}

export type AdminBroadcastTarget = "all_users" | "topic" | "userIds";

export type AdminBroadcastPayload = {
  title: string;
  message: string;
  target: AdminBroadcastTarget;
  topic?: string;
  userIds?: string[];
  data?: Record<string, string>;
};

export type AdminBroadcastResult = {
  queued: boolean;
  targetCount: number;
};

export type AdminBroadcastRecipient = {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  tokenCount: number;
};

export async function adminBroadcast(
  accessToken: string,
  payload: AdminBroadcastPayload,
) {
  const raw = await request<{
    success: boolean;
    message: string;
    data: AdminBroadcastResult;
  }>("/api/v1/admin/notifications/broadcast", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: payload,
  });
  return raw.data;
}

export async function adminBroadcastRecipients(
  accessToken: string,
  params?: { q?: string; limit?: number },
) {
  const raw = await request<{ success: boolean; data: { users: AdminBroadcastRecipient[] } }>(
    `/api/v1/admin/customers/notification-recipients${buildQuery({
      q: params?.q,
      limit: params?.limit,
    })}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data.users;
}

export type AdminDashboardRailHealth = {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  detail: string;
};

export type AdminDashboardOverview = {
  kpis: {
    totalVolumeSent: number | null;
    volumeCurrency: string | null;
    totalTransactions: number;
    successRatePercent: number | null;
    pendingTransactions: number;
    failedTransactions: number;
    successfulTransactions: number;
  };
  systemHealth: {
    cybrid: AdminDashboardRailHealth;
    mobileMoney: AdminDashboardRailHealth & {
      provider: string;
      lastCheckedAt: string | null;
    };
    bankTransfer: AdminDashboardRailHealth & {
      provider: string;
      lastCheckedAt: string | null;
    };
  };
  wallet: {
    balance: number | null;
    currency?: string | null;
    provider: string | null;
    error: string | null;
  };
  generatedAt: string;
};

type WrappedOverview = {
  success: boolean;
  data: AdminDashboardOverview;
  code?: string;
  message?: string;
};

export async function adminDashboardOverview(accessToken: string) {
  const raw = await request<WrappedOverview>("/api/v1/admin/transfers/overview", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

/** Cybrid dashboard book transfer (customer-driven account picker). */
export type AdminCybridBookTransferQuoteData = {
  quote_guid: string;
  quote: Record<string, unknown>;
};

export type AdminCybridBookTransferAccount = {
  guid: string;
  name: string;
  type: string;
  asset: string;
  state: string;
};

export type AdminCybridBookTransferAccountsData = {
  user_id: string;
  cybrid_customer_id: string;
  accounts: AdminCybridBookTransferAccount[];
  default_source_account_guid: string | null;
  default_destination_account_guid: string | null;
  warnings: string[];
};

export type AdminCybridBookTransferExecuteData = {
  user_id: string;
  cybrid_customer_id: string;
  transfer: Record<string, unknown>;
};

export async function adminCybridBookTransferCustomerAccounts(
  accessToken: string,
  userId: string,
) {
  const raw = await request<{ success: boolean; data: AdminCybridBookTransferAccountsData }>(
    `/api/v1/admin/payments/book-transfer/users/${encodeURIComponent(userId)}/accounts`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminCybridBookTransferQuote(accessToken: string, amountCents: number) {
  const raw = await request<{ success: boolean; data: AdminCybridBookTransferQuoteData }>(
    "/api/v1/admin/payments/book-transfer/quote",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: { amount: amountCents },
    },
  );
  return raw.data;
}

export async function adminCybridBookTransferExecute(
  accessToken: string,
  payload: {
    quote_guid: string;
    user_id: string;
    source_account_guid: string;
    destination_account_guid: string;
    amount: number;
  },
) {
  const raw = await request<{ success: boolean; data: AdminCybridBookTransferExecuteData }>(
    "/api/v1/admin/payments/book-transfer/execute",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: payload,
    },
  );
  return raw.data;
}

/** Platform FIAT → USDC_SOL trade + crypto transfer to external wallet (Yellow Card, etc.). */
export type AdminTradeAndTransferWallet = {
  guid: string;
  name: string;
  asset: string;
  state: string;
  address?: string;
};

export type AdminTradeAndTransferPreviewData = {
  fiat_balance_cents: number;
  fiat_account_guid: string;
  deliver_amount_usd_cents: number;
  trade_quote_guid: string;
  trade_quote: Record<string, unknown>;
  trading_account_guid: string;
  estimated_usdc_receive_minor: number;
  destination_external_wallet_guid: string | null;
  destination_wallet_source: "environment" | "request_body";
  bank_platform_trade_context: { bank_guid: string; quote_symbol: string };
};

export type AdminTradeAndTransferExecuteData = {
  status: "success";
  idempotent: boolean;
  operation_id: string;
  trade_id: string | null;
  transfer_id: string | null;
  crypto_quote_guid?: string;
  trade_quote_guid?: string | null;
  usdc_deliver_minor?: number;
  transfer_state?: string;
  metadata?: Record<string, unknown>;
};

export async function adminTradeAndTransferExternalWallets(accessToken: string) {
  const raw = await request<{ success: boolean; data: { wallets: AdminTradeAndTransferWallet[] } }>(
    "/api/v1/admin/payments/trade-and-transfer/external-wallets",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminTradeAndTransferPreview(
  accessToken: string,
  body: { use_full_fiat_balance: boolean; deliver_amount_usd_cents?: number },
) {
  const raw = await request<{ success: boolean; data: AdminTradeAndTransferPreviewData }>(
    "/api/v1/admin/payments/trade-and-transfer/preview",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export async function adminTradeAndTransferExecute(
  accessToken: string,
  body: {
    trade_quote_guid: string;
    deliver_amount_usd_cents: number;
    /** Omit when payment-service sets `CYBRID_ADMIN_TRADE_TRANSFER_EXTERNAL_WALLET_GUID`. */
    external_wallet_guid?: string;
    idempotency_key: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminTradeAndTransferExecuteData }>(
    "/api/v1/admin/payments/trade-and-transfer/execute",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export type AdminBullmqQueueSnapshot =
  | { queue: string; counts: Record<string, number>; paused: boolean }
  | { queue: string; error: string };

export type AdminQueueOverview = {
  generated_at: string;
  bullmq: AdminBullmqQueueSnapshot[];
  send_money_jobs: {
    by_status: Record<string, number>;
    recent: Array<{
      id: string;
      user_id: string;
      status: string;
      transfer_type: string;
      created_at: string;
      updated_at: string;
      transfer_guid: string | null;
      error_message: string | null;
    }>;
  };
};

export async function adminQueueOverview(accessToken: string) {
  const raw = await request<{ success: boolean; data: AdminQueueOverview }>(
    "/api/v1/admin/transfers/queue",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

/** Remittance row from GET /admins/remittance-transactions */
export type AdminRemittanceTransactionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  customer_email: string | null;
  transaction_ref: string;
  platform_transaction_id: string | null;
  cybrid_funding_transfer_guid: string | null;
  phone_number: string;
  amount: number | null;
  currency: string;
  amount_send: number | null;
  currency_send: string | null;
  amount_receive: number | null;
  currency_receive: string | null;
  /** Locked customer FX rate (receive per 1 send), from transfers.conversion_rate. */
  conversion_rate?: number | null;
  recipient_name: string | null;
  narration: string | null;
  account_number: string | null;
  bank_sort_code: string | null;
  transfer_type: string;
  recipient_entity_type?: "individual" | "business" | null;
  payment_type: string;
  provider: string;
  reference_id: string | null;
  provider_reference: string | null;
  status: string;
  provider_status: string | null;
  error_message: string | null;
  bond_amount_cents: number | null;
  bond_amount_usd: number | null;
  fee_charges: number | null;
  fee_basis_points: number | null;
  cybrid_transaction_status: string | null;
  payout_provider_status: string | null;
  funding_method?: string | null;
  funding_kind?: "card" | "cybrid_bank" | "wallet" | "ops" | "unknown" | null;
  funding_label?: string | null;
  funding_rail?: string | null;
  funding_rail_label?: string | null;
  funding_decision_source?: string | null;
  funding_decision_label?: string | null;
  funding_instrument?: string | null;
  funding_bank_name?: string | null;
  funding_account_mask?: string | null;
  linked_bank_account_id?: string | null;
  linked_debit_card_id?: string | null;
  split_funding?: boolean;
  funding_legs?: AdminFundingLeg[];
};

export type AdminFundingLeg = {
  role: "remittance" | "bond";
  amount_cents: number | null;
  amount_usd: number | null;
  funding_method: string | null;
  funding_kind: "card" | "cybrid_bank" | "wallet" | "ops" | "unknown" | null;
  funding_label: string;
  funding_rail: string | null;
  funding_rail_label: string | null;
  funding_instrument: string | null;
  status: string | null;
  payment_transfer_id: string | null;
  provider_reference: string | null;
  cybrid_funding_transfer_guid: string | null;
  linked_bank_account_id: string | null;
  linked_debit_card_id: string | null;
  failure_reason: string | null;
};

export type AdminRemittanceTransactionsResult = {
  transactions: AdminRemittanceTransactionRow[];
  pagination: { limit: number; offset: number; total: number };
};

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (typeof v === "boolean") {
      usp.set(k, v ? "true" : "false");
    } else {
      usp.set(k, String(v));
    }
  }
  const q = usp.toString();
  return q ? `?${q}` : "";
}

export async function adminRemittanceTransactions(
  accessToken: string,
  params: {
    limit?: number;
    offset?: number;
    sort?: "created_at_desc" | "created_at_asc";
    date_from?: string;
    date_to?: string;
    status?: string;
    amount_min?: string;
    amount_max?: string;
    q?: string;
    recipient_entity_type?: "individual" | "business";
  },
) {
  const raw = await request<{ success: boolean; data: AdminRemittanceTransactionsResult }>(
    `/api/v1/admin/transfers${buildQuery(params)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminRemittanceTransactionById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { transaction: AdminRemittanceTransactionRow } }>(
    `/api/v1/admin/transfers/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.transaction;
}

export type AdminRetryPegasusPayoutResult = {
  payout: {
    status?: string;
    providerReference?: string | null;
    failureReason?: string | null;
    paymentTransferId?: string | null;
  };
  transaction: AdminRemittanceTransactionRow | null;
};

/** Super-admin: re-poll Pegasus after INVALID TRANSACTION DETAILS poll timeout. */
export async function adminRetryPegasusPayout(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: AdminRetryPegasusPayoutResult }>(
    `/api/v1/admin/transfers/${encodeURIComponent(id)}/retry-payout`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminBankListItem = {
  bankName: string;
  bankCode: string;
  operateTime: string | null;
};

export async function adminBanksList(accessToken: string) {
  const raw = await request<{ success: boolean; data: { banks: AdminBankListItem[] } }>(
    "/api/v1/admin/transfers/banks",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.banks;
}

/** Row from transfer.remittance_fees_config (admin GET/POST/PATCH /exchange-rates). */
export type AdminRemittanceFeeRow = {
  id: string;
  platform: string;
  transactionType: string;
  currency: string;
  providerRate: number;
  customerRate: number;
  hasBoughtBond: boolean;
  borabondFee: number;
  remittanceFee: number;
  basisPoints: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
  instant: number | null;
  requestMoneyInstant: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminRemittanceFeeWriteBody = {
  platform?: string;
  transaction_type?: string;
  currency?: string;
  provider_rate?: number;
  customer_rate?: number;
  has_bought_bond?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  is_active?: boolean;
  request_money_instant?: number | null;
};

export async function adminExchangeRatesList(accessToken: string) {
  const raw = await request<{ success: boolean; data: { rates: AdminRemittanceFeeRow[] } }>(
    "/api/v1/admin/transfers/exchange-rates",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.rates;
}

export async function adminCreateExchangeRate(
  accessToken: string,
  body: AdminRemittanceFeeWriteBody & { currency: string; provider_rate: number; customer_rate: number },
) {
  const raw = await request<{ success: boolean; data: { rate: AdminRemittanceFeeRow } }>(
    "/api/v1/admin/transfers/exchange-rates",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.rate;
}

export async function adminPatchExchangeRate(
  accessToken: string,
  id: string,
  body: AdminRemittanceFeeWriteBody,
) {
  const raw = await request<{ success: boolean; data: { rate: AdminRemittanceFeeRow } }>(
    `/api/v1/admin/transfers/exchange-rates/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.rate;
}

export async function adminDeleteExchangeRate(accessToken: string, id: string) {
  await request<{ success: boolean; data: { id: string } }>(
    `/api/v1/admin/transfers/exchange-rates/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

/** Row from transfer.remittance_business_rates (ops business FX). */
export type AdminBusinessRateRow = {
  id: string;
  sendCurrency: string;
  receiveCurrency: string;
  businessRate: number;
  providerRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminBusinessRateWriteBody = {
  send_currency?: string;
  receive_currency?: string;
  business_rate?: number;
  provider_rate?: number | null;
  notes?: string | null;
  is_active?: boolean;
};

export async function adminBusinessRatesList(accessToken: string) {
  const raw = await request<{ success: boolean; data: { rates: AdminBusinessRateRow[] } }>(
    "/api/v1/admin/transfers/business-rates",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.rates;
}

export async function adminCreateBusinessRate(
  accessToken: string,
  body: AdminBusinessRateWriteBody & { receive_currency: string; business_rate: number },
) {
  const raw = await request<{ success: boolean; data: { rate: AdminBusinessRateRow } }>(
    "/api/v1/admin/transfers/business-rates",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.rate;
}

export async function adminPatchBusinessRate(
  accessToken: string,
  id: string,
  body: AdminBusinessRateWriteBody,
) {
  const raw = await request<{ success: boolean; data: { rate: AdminBusinessRateRow } }>(
    `/api/v1/admin/transfers/business-rates/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.rate;
}

export async function adminDeleteBusinessRate(accessToken: string, id: string) {
  await request<{ success: boolean; data: { id: string } }>(
    `/api/v1/admin/transfers/business-rates/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

/** Ops business partner (transfer.remittance_business_partners). */
export type AdminBusinessPartnerRow = {
  id: string;
  legalName: string;
  tradingName: string | null;
  countryCode: string;
  receiveCurrency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  pegasusSenderMsisdn: string | null;
  bankValidatedAt: string | null;
  bankValidationReference: string | null;
  bankValidationAccountName: string | null;
  hasValidatedBank: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminBusinessPartnerWriteBody = {
  legal_name?: string;
  trading_name?: string | null;
  country_code?: string;
  receive_currency?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
  bank_account_number?: string | null;
  bank_sort_code?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  pegasus_sender_msisdn?: string | null;
  bank_validated_at?: string | null;
  bank_validation_reference?: string | null;
  bank_validation_account_name?: string | null;
};

export async function adminBusinessPartnersList(
  accessToken: string,
  params?: {
    q?: string;
    country_code?: string;
    receive_currency?: string;
    active_only?: boolean;
    limit?: number;
    offset?: number;
  },
) {
  const raw = await request<{
    success: boolean;
    data: { partners: AdminBusinessPartnerRow[]; total: number };
  }>(
    `/api/v1/admin/transfers/business-partners${buildQuery({
      q: params?.q,
      country_code: params?.country_code,
      receive_currency: params?.receive_currency,
      active_only: params?.active_only === false ? "false" : undefined,
      limit: params?.limit,
      offset: params?.offset,
    })}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminBusinessPartnerGet(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { partner: AdminBusinessPartnerRow } }>(
    `/api/v1/admin/transfers/business-partners/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.partner;
}

export async function adminCreateBusinessPartner(
  accessToken: string,
  body: AdminBusinessPartnerWriteBody & { legal_name: string },
) {
  const raw = await request<{ success: boolean; data: { partner: AdminBusinessPartnerRow } }>(
    "/api/v1/admin/transfers/business-partners",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.partner;
}

export async function adminPatchBusinessPartner(
  accessToken: string,
  id: string,
  body: AdminBusinessPartnerWriteBody,
) {
  const raw = await request<{ success: boolean; data: { partner: AdminBusinessPartnerRow } }>(
    `/api/v1/admin/transfers/business-partners/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` }, json: body },
  );
  return raw.data.partner;
}

export type AdminBusinessPartnerLedgerStats = {
  totalTransactions: number;
  amountTransacted: { currency: string; amountMajor: number };
  receiveByCurrency: Array<{ currency: string; amountMajor: number }>;
  totalFeesUsd: number;
};

export async function adminBusinessPartnerLedgerStats(accessToken: string) {
  const raw = await request<{ success: boolean; data: { stats: AdminBusinessPartnerLedgerStats } }>(
    "/api/v1/admin/transfers/business-partners/stats",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.stats;
}

export type AdminSendMoneyBusinessRate = {
  businessRate: number;
  providerRate: number | null;
  sendCurrency: string;
  receiveCurrency: string;
  source?: string;
};

export async function adminSendMoneyBusinessRate(
  accessToken: string,
  params: { receive_currency: string; send_currency?: string },
) {
  const raw = await request<{ success: boolean; data: AdminSendMoneyBusinessRate }>(
    `/api/v1/admin/transfers/business-rates/active${buildQuery({
      receive_currency: params.receive_currency,
      send_currency: params.send_currency,
    })}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminSavedRecipientRow = {
  id: string;
  user_id: string;
  customer_email: string | null;
  recipient_name: string;
  transfer_type: string;
  phone_number: string | null;
  network: string | null;
  bank_name: string | null;
  account_number: string | null;
  bank_sort_code: string | null;
  country_code: string | null;
  last_used_at: string | null;
  send_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminSavedRecipientsResult = {
  recipients: AdminSavedRecipientRow[];
  pagination: { limit: number; offset: number; total: number };
  meta: { frequent_min_sends: number };
};

export async function adminSavedRecipientsList(
  accessToken: string,
  params: {
    limit?: number;
    offset?: number;
    q?: string;
    transfer_type?: "mobile_money" | "bank";
    country_code?: string;
    tab?: "all" | "mobile_money" | "bank" | "frequent";
    include_inactive?: boolean;
    is_active?: boolean;
  },
) {
  const raw = await request<{ success: boolean; data: AdminSavedRecipientsResult }>(
    `/api/v1/admin/customers/recipients${buildQuery({
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      transfer_type: params.transfer_type,
      country_code: params.country_code,
      tab: params.tab,
      include_inactive: params.include_inactive === true ? "true" : undefined,
      is_active:
        params.is_active === true ? "true" : params.is_active === false ? "false" : undefined,
    })}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminCreateSavedRecipient(
  accessToken: string,
  body: {
    user_id: string;
    recipient_name: string;
    transfer_type: "mobile_money" | "bank";
    phone_number?: string;
    network?: string;
    bank_name?: string;
    account_number?: string;
    bank_sort_code?: string;
    country_code?: string;
    upsert?: boolean;
  },
) {
  const raw = await request<{ success: boolean; data: { recipient: AdminSavedRecipientRow } }>(
    "/api/v1/admin/customers/recipients",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data.recipient;
}

export async function adminUpdateSavedRecipient(
  accessToken: string,
  id: string,
  body: {
    recipient_name?: string;
    phone_number?: string;
    network?: string;
    bank_name?: string;
    account_number?: string;
    bank_sort_code?: string;
    country_code?: string;
  },
) {
  const raw = await request<{ success: boolean; data: { recipient: AdminSavedRecipientRow } }>(
    `/api/v1/admin/customers/recipients/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data.recipient;
}

export async function adminSetRecipientActive(accessToken: string, id: string, is_active: boolean) {
  const raw = await request<{ success: boolean; data: { recipient: AdminSavedRecipientRow } }>(
    `/api/v1/admin/customers/recipients/${encodeURIComponent(id)}/active`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: { is_active },
    },
  );
  return raw.data.recipient;
}

export async function adminDeleteSavedRecipient(accessToken: string, id: string) {
  await request<{ success: boolean; data: unknown }>(
    `/api/v1/admin/customers/recipients/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

/** SMS notification log row (sms_notification_logs) */
export type AdminSmsNotificationLogRow = {
  id: string;
  dedupe_key: string;
  remittance_transaction_id: string | null;
  phone_number: string;
  message: string;
  status: string;
  attempts: number;
  provider_response: unknown | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sibling_logs_for_same_tx: number;
};

export type AdminSmsNotificationLogsResult = {
  logs: AdminSmsNotificationLogRow[];
  pagination: { limit: number; offset: number; total: number };
};

export async function adminSmsNotificationLogs(
  accessToken: string,
  params: {
    limit?: number;
    offset?: number;
    sort?: "created_at_desc" | "created_at_asc";
    status?: string;
    date_from?: string;
    date_to?: string;
    attempts_min?: number;
    q?: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminSmsNotificationLogsResult }>(
    `/api/v1/admin/notifications/sms-logs${buildQuery(params)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminSmsNotificationLogById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { log: AdminSmsNotificationLogRow } }>(
    `/api/v1/admin/notifications/sms-logs/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.log;
}

export async function adminSmsNotificationRetry(accessToken: string, id: string) {
  const raw = await request<{
    success: boolean;
    data: { queued: boolean; log: AdminSmsNotificationLogRow };
  }>(`/api/v1/admin/notifications/sms-logs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

/** GET /admins/system/overview */
export type SystemRailCard = {
  label: string;
  status: string;
  detail?: string;
  provider?: string;
  responseTimeMs: number | null;
  errorRate: number | null;
  lastCheckedAt: string | null;
  lastError?: string | null;
};

export type SystemControlCenterOverview = {
  generatedAt: string;
  banner: {
    overallStatus: "operational" | "partial" | "outage";
    message: string;
  };
  rails: {
    cybrid: SystemRailCard;
    mobileMoney: SystemRailCard;
    bank: SystemRailCard;
  };
  providerHealth: Array<{
    provider: string;
    status: string;
    uiStatus: string;
    avgResponseTimeMs: number | null;
    errorRate: number | null;
    lastCheckedAt: string | null;
    lastError: string | null;
    balance: number | null;
  }>;
  serviceProviders: Array<{
    id: string;
    providerName: string;
    providerType: string;
    isActive: boolean;
    config: Record<string, unknown>;
    country: string | null;
    network: string | null;
    updatedAt: string;
  }>;
  apiMetrics: {
    last1h: {
      totalRequests: number;
      successRate: number;
      errorRatePercent: number;
      avgLatencyMs: number;
    };
    last24h: {
      totalRequests: number;
      successRate: number;
      errorRatePercent: number;
      avgLatencyMs: number;
    };
    hourly: Array<{
      label: string;
      totalRequests: number;
      successRate: number;
      avgLatencyMs: number;
    }>;
  };
};

export async function adminSystemOverview(accessToken: string) {
  const overview = await adminDashboardOverview(accessToken);
  const unknownRail = (
    label: string,
    provider?: string,
  ): SystemRailCard => ({
    label,
    status: overview.systemHealth.cybrid.status,
    detail: overview.systemHealth.cybrid.detail,
    provider,
    responseTimeMs: null,
    errorRate: null,
    lastCheckedAt: null,
  });
  const data: SystemControlCenterOverview = {
    generatedAt: overview.generatedAt,
    banner: {
      overallStatus: "partial",
      message: "Rail health is sourced from transfer KPIs on the microservices platform.",
    },
    rails: {
      cybrid: unknownRail("Cybrid", "cybrid"),
      mobileMoney: unknownRail("Mobile money", overview.systemHealth.mobileMoney.provider),
      bank: unknownRail("Bank", overview.systemHealth.bankTransfer.provider),
    },
    providerHealth: [],
    serviceProviders: [],
    apiMetrics: {
      last1h: { totalRequests: 0, successRate: 0, errorRatePercent: 0, avgLatencyMs: 0 },
      last24h: {
        totalRequests: overview.kpis.totalTransactions,
        successRate: overview.kpis.successRatePercent ?? 0,
        errorRatePercent: overview.kpis.successRatePercent == null ? 0 : 100 - overview.kpis.successRatePercent,
        avgLatencyMs: 0,
      },
      hourly: [],
    },
  };
  return data;
}

export type ProviderMetricLogRow = {
  id: string;
  providerName: string;
  endpoint: string;
  status: string;
  responseTimeMs: number;
  httpStatus: number | null;
  createdAt: string;
};

export async function adminProviderLogs(accessToken: string, providerName: string, limit?: number) {
  const raw = await request<{ success: boolean; data: { logs: ProviderMetricLogRow[] } }>(
    `/api/v1/admin/payments/system/provider-logs/${encodeURIComponent(providerName)}${buildQuery({ limit })}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.logs;
}

export async function adminCreateServiceProvider(
  accessToken: string,
  body: {
    provider_name: string;
    provider_type?: string;
    is_active?: boolean;
    config?: Record<string, unknown>;
  },
) {
  const raw = await request<{
    success: boolean;
    data: { provider: Record<string, unknown> };
  }>("/api/v1/admin/payments/system/service-providers", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return raw.data.provider as {
    id: string;
    providerName: string;
    providerType: string;
    isActive: boolean;
    config: Record<string, unknown>;
    updatedAt: string;
  };
}

export async function adminPatchServiceProvider(
  accessToken: string,
  id: string,
  body: {
    provider_name?: string;
    provider_type?: string;
    is_active?: boolean;
    config?: Record<string, unknown>;
  },
) {
  const raw = await request<{
    success: boolean;
    data: { provider: Record<string, unknown> };
  }>(`/api/v1/admin/payments/system/service-providers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return raw.data.provider as {
    id: string;
    providerName: string;
    providerType: string;
    isActive: boolean;
    config: Record<string, unknown>;
    updatedAt: string;
  };
}

export async function adminDeleteServiceProvider(accessToken: string, id: string) {
  await request<{ success: boolean; data: { id: string } }>(
    `/api/v1/admin/payments/system/service-providers/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

/** Platform audit_logs */
export type AdminPlatformAuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_type: string;
  actor_id: string | null;
  user_id: string | null;
  device: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata_preview: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export async function adminPlatformAuditLogs(
  accessToken: string,
  params: {
    limit?: number;
    offset?: number;
    sort?: "created_at_desc" | "created_at_asc";
    action?: string;
    entity_type?: string;
    actor_type?: string;
    user_id?: string;
    device?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
  },
) {
  const raw = await request<{
    success: boolean;
    data: {
      logs: AdminPlatformAuditLogRow[];
      pagination: { limit: number; offset: number; total: number };
    };
  }>(`/api/v1/admin/payments/audit-logs${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export async function adminPlatformAuditAnomalies(accessToken: string) {
  const raw = await request<{
    success: boolean;
    data: {
      highTrafficIps: { ip_address: string; count: number }[];
      repeatedFailures: { action: string; count: number }[];
    };
  }>("/api/v1/admin/payments/audit-logs/anomalies", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

/** admin_audit_logs (remittance dashboard admins) */
export type AdminRemittanceAuditLogRow = {
  id: string;
  created_at: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  metadata_preview: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
};

export async function adminRemittanceAuditLogs(
  accessToken: string,
  params: {
    limit?: number;
    offset?: number;
    sort?: "created_at_desc" | "created_at_asc";
    admin_id?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
  },
) {
  const raw = await request<{
    success: boolean;
    data: {
      logs: AdminRemittanceAuditLogRow[];
      pagination: { limit: number; offset: number; total: number };
    };
  }>(`/api/v1/admin/payments/remittance-admin-audit${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export type AdminAccountLockFields = {
  account_status?: string | null;
  is_locked?: boolean;
  locked_at?: string | null;
  failed_login_attempts?: number;
};

export function isCustomerAccountLocked(u: AdminAccountLockFields | null | undefined): boolean {
  if (!u) return false;
  return u.is_locked === true || u.account_status === "LOCKED";
}

/** user_profiles + LEFT JOIN cybrid_customers (admin directory) */
export type AdminUserDirectoryRow = AdminAccountLockFields & {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  verification_status: string | null;
  is_verified: boolean;
  is_active: boolean;
  onboarding_completed: boolean | null;
  onboarding_required?: boolean | null;
  product_intent?: "send_only" | "send_and_invest" | null;
  account_purpose?: string | null;
  last_login_at: string | null;
  customer_segment?: "new" | "old" | null;
  is_new_customer?: boolean | null;
  is_online?: boolean;
  last_seen_at?: string | null;
  device?: "ios" | "android" | "web" | "unknown";
  device_user_agent?: string | null;
  cybrid_customer_id: string | null;
  cybrid_verification_status: string | null;
  external_bank_accounts_count: number | null;
  kyc_state: string | null;
  cybrid_linked: boolean;
  warnings: string[];
};

export async function adminUsersList(
  accessToken: string,
  params: {
    q?: string;
    limit?: number;
    offset?: number;
    verified?: boolean;
    active?: boolean;
    online?: boolean;
    cybrid?: "linked" | "not_linked";
  },
) {
  const raw = await request<{
    success: boolean;
    data: {
      users: AdminUserDirectoryRow[];
      pagination: { limit: number; offset: number; total: number };
    };
  }>(`/api/v1/admin/users${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export type AdminUserDetailResponse = {
  profile: AdminAccountLockFields & {
    user_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    verification_status: string | null;
    is_verified: boolean;
    is_active: boolean;
    onboarding_completed: boolean | null;
    onboarding_required?: boolean | null;
    onboarding_step: number | null;
    product_intent?: "send_only" | "send_and_invest" | null;
    account_purpose?: string | null;
    last_login: string | null;
    last_login_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    cybrid_integration_completed: boolean | null;
    customer_segment?: "new" | "old" | null;
    is_new_customer?: boolean | null;
    is_online?: boolean;
    last_seen_at?: string | null;
    device?: "ios" | "android" | "web" | "unknown";
    device_user_agent?: string | null;
  };
  cybrid: {
    cybrid_customer_id: string;
    verification_status: string | null;
    external_bank_accounts_count: number | null;
    kyc_state: string | null;
  } | null;
  eligibility: {
    can_transfer: boolean;
    blockers: { code: string; message: string }[];
  };
};

export async function adminUserDetail(accessToken: string, userId: string) {
  const raw = await request<{ success: boolean; data: AdminUserDetailResponse }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminUserUnlock(accessToken: string, userId: string) {
  const raw = await request<{ success: boolean; data: unknown }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/unlock`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminUserLock(accessToken: string, userId: string) {
  const raw = await request<{ success: boolean; data: unknown }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/lock`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export type AdminPullFundsBankAccount = {
  guid: string;
  state: string | null;
  bank_name: string | null;
  plaid_account_name: string | null;
  account_mask: string | null;
  is_ready: boolean;
};

export type AdminPullFundsBankAccountsResponse = {
  user_id: string;
  customer_guid: string;
  accounts: AdminPullFundsBankAccount[];
};

export type AdminPullFundsExecuteResponse = {
  status: "success";
  idempotent: boolean;
  operation_id: string;
  user_id: string;
  customer_guid: string;
  external_bank_account_guid: string;
  amount_usd: number;
  note: string | null;
  cybrid_quote_guid?: string;
  cybrid_transfer_guid?: string;
  cybrid_transfer_state?: string;
  remittance_transaction_id?: string;
};

export async function adminPullFundsBankAccounts(
  accessToken: string,
  userId: string,
) {
  const raw = await request<{ success: boolean; data: AdminPullFundsBankAccountsResponse }>(
    `/api/v1/admin/payments/pull-funds/users/${encodeURIComponent(userId)}/bank-accounts`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

export async function adminPullFundsExecute(
  accessToken: string,
  payload: {
    userId: string;
    customerGuid: string;
    externalBankAccountGuid: string;
    amount: number;
    note?: string;
    idempotencyKey?: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminPullFundsExecuteResponse }>(
    "/api/v1/admin/payments/pull-funds",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: payload,
    },
  );
  return raw.data;
}

export type AdminBankDeleteRequest = {
  id: string;
  customer_id: string | null;
  email: string;
  reason: string | null;
  source: string;
  status: string;
  reference_id: string | null;
  linked_bank_account_id: string | null;
  bank_name: string | null;
  account_mask: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** GET /api/v1/admin/payments/bank-delete-requests */
export async function adminListBankDeleteRequests(
  accessToken: string,
  params?: { status?: string; limit?: number },
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  const raw = await request<{ success: boolean; data: AdminBankDeleteRequest[] }>(
    `/api/v1/admin/payments/bank-delete-requests${suffix}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
}

/** POST /api/v1/admin/payments/bank-delete-requests/:id/approve */
export async function adminApproveBankDeleteRequest(
  accessToken: string,
  requestId: string,
  notes?: string,
) {
  const raw = await request<{
    success: boolean;
    data: {
      requestId: string;
      deleted: boolean;
      customerId: string | null;
      referenceId: string | null;
    };
  }>(`/api/v1/admin/payments/bank-delete-requests/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: notes?.trim() ? { notes: notes.trim() } : {},
  });
  return raw.data;
}

/** POST /api/v1/admin/payments/bank-delete-requests/:id/reject */
export async function adminRejectBankDeleteRequest(
  accessToken: string,
  requestId: string,
  notes?: string,
) {
  const raw = await request<{
    success: boolean;
    data: { requestId: string; status: string };
  }>(`/api/v1/admin/payments/bank-delete-requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: notes?.trim() ? { notes: notes.trim() } : {},
  });
  return raw.data;
}

export type CybridQuoteLike = {
  guid: string;
  product_type?: string;
  asset?: string;
  side?: string;
  receive_amount?: number;
  deliver_amount?: number;
  fee?: number;
  rate?: number;
  state?: string;
  created_at?: string;
};

export type CybridTransferLike = {
  guid: string;
  transfer_type?: string;
  quote_guid?: string;
  state?: string;
  failure_code?: string;
  created_at?: string;
};

export type AdminTradingSnapshot = {
  user_id: string | null;
  cybrid_customer_id: string | null;
  trading_account_guid: string | null;
  platform_balance_minor: number;
  external_wallets: { guid?: string; address?: string; name?: string; state?: string }[];
  eligibility_blockers: { code: string; message: string }[];
  warnings: string[];
};

/** Cybrid trading snapshot for a user (GET /admins/users/:id/trading-snapshot). */
export async function adminUserTradingSnapshot(accessToken: string, userId: string) {
  const raw = await request<{ success: boolean; data: AdminTradingSnapshot }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/trading-snapshot`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminBorapayBookBalance = {
  user_id: string;
  cybrid_customer_id: string;
  borapay_fiat_account_guid: string | null;
  /** Minor units (USD cents) — from Cybrid `platform_balance` when present, else balances API. */
  platform_balance_minor: number;
  balance_amount_raw: string | null;
  platform_balance_usd: string;
};

/** BoraPay USD amount for book-transfer field (GET /admins/users/:id/borapay-book-balance). */
export async function adminUserBorapayBookBalance(accessToken: string, userId: string) {
  const raw = await request<{ success: boolean; data: AdminBorapayBookBalance }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/borapay-book-balance`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminBatchOpResult = {
  success: Record<string, unknown>[];
  failed: { user_id: string; error: string }[];
};

export async function adminTransferBook(
  accessToken: string,
  body: { user_ids: string[]; amount_cents?: number; idempotency_key?: string },
) {
  const raw = await request<{ success: boolean; data: AdminBatchOpResult }>(
    "/api/v1/admin/payments/book-transfer/execute",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export async function adminTradeBatch(
  accessToken: string,
  body: {
    /** Omit or empty = bank/platform trade (no end-user), per Cybrid quote with bank_guid. */
    user_ids?: string[];
    deliver_amount_usd: number;
    idempotency_key?: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminBatchOpResult }>(
    "/api/v1/admin/payments/trades",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export type AdminWithdrawPlatformWallet = {
  guid: string;
  name: string;
  asset: string;
  state: string;
  address?: string;
};

/** Resolve Cybrid "Platform Wallet" (USDC_SOL, completed) for admin withdraw. */
export async function adminWithdrawPlatformWallet(accessToken: string) {
  const raw = await request<{ success: boolean; data: AdminWithdrawPlatformWallet }>(
    "/api/v1/admin/payments/withdrawals/platform-wallet",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminWithdrawPlatformTradingBalance = {
  account_guid: string;
  platform_balance_minor: number;
  name?: string;
};

/** Bank-owned USDC_SOL trading account `platform_balance` (GET /accounts?owner=bank&bank_guid=…). */
export async function adminWithdrawPlatformTradingBalance(accessToken: string) {
  const raw = await request<{ success: boolean; data: AdminWithdrawPlatformTradingBalance }>(
    "/api/v1/admin/payments/withdrawals/platform-trading-balance",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminWithdrawBatch(
  accessToken: string,
  body: {
    user_ids: string[];
    deliver_amount_minor: number;
    /** Unused: server uses `CYBRID_BANK_GUID` for crypto transfer participants. */
    bank_guid?: string;
    idempotency_key?: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminBatchOpResult }>(
    "/api/v1/admin/payments/withdrawals",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export type AdminOperationLogRow = {
  id: string;
  user_id: string;
  operation_type: string;
  status: string;
  metadata: object | null;
  idempotency_key: string | null;
  error_message: string | null;
  admin_id: string | null;
  created_at: string;
};

export async function adminOperationsList(
  accessToken: string,
  params?: { limit?: number; offset?: number; user_id?: string; operation_type?: string },
) {
  const raw = await request<{
    success: boolean;
    data: {
      operations: AdminOperationLogRow[];
      pagination: { limit: number; offset: number; total: number };
    };
  }>(`/api/v1/admin/payments/operations${buildQuery(params ?? {})}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

/** GET /admins/send-money/customer-rate — rate for a specific app user (ops JWT). */
export type AdminSendMoneyCustomerRate = {
  customerRate: number;
  providerRate: number;
  hasBoughtBond?: boolean;
  currency?: string;
  platform?: string;
  transactionType?: string;
};

export async function adminSendMoneyCustomerRate(
  accessToken: string,
  params: { user_id: string; useBondRate?: boolean },
) {
  const raw = await request<{ success: boolean; data: AdminSendMoneyCustomerRate }>(
    `/api/v1/admin/transfers/send-money/customer-rate${buildQuery({
      user_id: params.user_id,
      useBondRate: params.useBondRate,
    })}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminSendMoneyValidateResult = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  providerReference: string;
};

/** POST /admins/send-money/validate-account — includes API code/message for UI status. */
export type AdminSendMoneyValidateAccountResponse = AdminSendMoneyValidateResult & {
  apiCode: string | undefined;
  apiMessage: string;
  /** Backend success code (e.g. ACCOUNT_VALIDATED). */
  isProviderSuccess: boolean;
  /** Parsed display name looks like a real beneficiary (not "not found" / empty). */
  hasUsableRecipientName: boolean;
};

export async function adminSendMoneyValidateAccount(
  accessToken: string,
  body: { user_id?: string; payload: Record<string, unknown> },
): Promise<AdminSendMoneyValidateAccountResponse> {
  const raw = await request<{
    success: boolean;
    code?: string;
    message?: string;
    data?: AdminSendMoneyValidateResult | null;
  }>("/api/v1/admin/payments/validate-account", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body.user_id ? body : { payload: body.payload },
  });
  const d = raw.data;
  const accountName = d != null && typeof d === "object" ? String((d as AdminSendMoneyValidateResult).accountName ?? "") : "";
  const accountNumber =
    d != null && typeof d === "object" ? String((d as AdminSendMoneyValidateResult).accountNumber ?? "") : "";
  const bankCode = d != null && typeof d === "object" ? String((d as AdminSendMoneyValidateResult).bankCode ?? "") : "";
  const providerReference =
    d != null && typeof d === "object" ? String((d as AdminSendMoneyValidateResult).providerReference ?? "") : "";
  const code = raw.code;
  const isProviderSuccess = code === "ACCOUNT_VALIDATED";
  const hasUsableRecipientName =
    accountName.trim().length > 0 &&
    !/^not\s*found$/i.test(accountName.trim()) &&
    accountName.trim().toLowerCase() !== "null";
  return {
    accountName,
    accountNumber,
    bankCode,
    providerReference,
    apiCode: code,
    apiMessage: typeof raw.message === "string" ? raw.message : "",
    isProviderSuccess,
    hasUsableRecipientName,
  };
}

export type AdminSendMoneyJobCreateBody = {
  instant_funding: {
    customer_guid: string;
    receive_amount: number;
    bond_amount?: number;
    bond_percentage?: number;
    external_id: string;
  };
  transfer_type: "mobile_money" | "bank";
  mobile_money?: Record<string, unknown>;
  bank?: Record<string, unknown>;
  request_metadata?: Record<string, unknown>;
};

export type AdminSendMoneyJobCreateResult = {
  id?: string;
  jobId?: string;
  status: string;
  transfer_guid?: string | null;
  result?: Record<string, unknown> | null;
  error_message?: string | null;
};

/** POST /admins/send-money/jobs */
export async function adminSendMoneyCreateJob(
  accessToken: string,
  body: { user_id: string; job: AdminSendMoneyJobCreateBody },
) {
  const raw = await request<{ success: boolean; data: AdminSendMoneyJobCreateResult }>(
    "/api/v1/admin/transfers/send-money/jobs",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}

export type AdminSendMoneyJobRow = {
  id: string;
  status: string;
  transfer_guid?: string | null;
  result?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** GET /admins/send-money/jobs/:id */
export async function adminSendMoneyGetJob(accessToken: string, jobId: string) {
  const raw = await request<{ success: boolean; data: AdminSendMoneyJobRow }>(
    `/api/v1/admin/transfers/send-money/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export type AdminFundingControls = {
  customer_id: string;
  force_card_routing: boolean;
  /** NEW-customer ACH trust; absent on older API responses → treat as false. */
  manual_ach_override?: boolean;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

/** GET /api/v1/admin/transfers/customers/:id/funding-controls */
export async function adminGetFundingControls(accessToken: string, customerId: string) {
  const raw = await request<{ success: boolean; data: AdminFundingControls }>(
    `/api/v1/admin/transfers/customers/${encodeURIComponent(customerId)}/funding-controls`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

/** PATCH /api/v1/admin/transfers/customers/:id/funding-controls */
export async function adminPatchFundingControls(
  accessToken: string,
  customerId: string,
  body: {
    force_card_routing?: boolean;
    manual_ach_override?: boolean;
    notes?: string;
  },
) {
  const raw = await request<{ success: boolean; data: AdminFundingControls }>(
    `/api/v1/admin/transfers/customers/${encodeURIComponent(customerId)}/funding-controls`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: body,
    },
  );
  return raw.data;
}
