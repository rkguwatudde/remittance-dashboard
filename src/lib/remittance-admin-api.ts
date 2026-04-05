/**
 * Remittance API — dashboard admin auth (/api/v1/admins/*).
 *
 * Base URL: NEXT_PUBLIC_REMITTANCE_API_URL
 * - Local: http://localhost:9002 (direct to Nest; CORS allowlist includes localhost).
 * - Production (duplicate CORS at Cloudflare/nginx): /api/remittance-backend and set
 *   REMITTANCE_API_UPSTREAM=https://remittance.api.borabond.com in next.config (rewrites).
 */

const baseUrl = () =>
  (process.env.NEXT_PUBLIC_REMITTANCE_API_URL || "http://localhost:9002").replace(
    /\/$/,
    "",
  );

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
  if (typeof m === "string" && m) return m;
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
};

export async function adminLogin(email: string, password: string) {
  return request<AdminLoginStep1Response>("/api/v1/admins/auth/login", {
    method: "POST",
    json: { email, password },
  });
}

export async function adminVerifyOtp(session_id: string, otp: string) {
  return request<AdminVerifyOtpResponse>("/api/v1/admins/auth/verify-otp", {
    method: "POST",
    json: { session_id, otp },
  });
}

export async function adminForgotPassword(email: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admins/auth/forgot-password",
    { method: "POST", json: { email } },
  );
}

export async function adminResetPassword(token: string, new_password: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admins/auth/reset-password",
    { method: "POST", json: { token, new_password } },
  );
}

export async function adminRefresh(refresh_token: string) {
  return request<AdminRefreshResponse>("/api/v1/admins/auth/refresh", {
    method: "POST",
    json: { refresh_token },
  });
}

export async function adminLogout(accessToken: string, refresh_token?: string) {
  return request<{ success: boolean; message: string }>(
    "/api/v1/admins/auth/logout",
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
    "/api/v1/admins/auth/change-password",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      json: { current_password, new_password },
    },
  );
}

/** Super-admin team management: GET/POST /api/v1/admins */
export type AdminTeamMember = {
  id: string;
  email: string;
  role: string;
  isActive?: boolean;
  is_active?: boolean;
  mustResetPassword?: boolean;
  must_reset_password?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  createdByAdminId?: string | null;
  created_by_admin_id?: string | null;
};

export const ADMIN_CREATE_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
] as const;

export async function adminListTeam(accessToken: string) {
  const raw = await request<{ success: boolean; data: { admins: AdminTeamMember[] } }>(
    "/api/v1/admins",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.admins;
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
  }>("/api/v1/admins", {
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
  }>(`/api/v1/admins/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return raw.data.admin;
}

export type AdminDashboardRailHealth = {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  detail: string;
};

export type AdminDashboardOverview = {
  kpis: {
    totalVolumeSent: number;
    volumeCurrency: string;
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
  const raw = await request<WrappedOverview>("/api/v1/admins/dashboard/overview", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
    "/api/v1/admins/queue/overview",
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
  recipient_name: string | null;
  narration: string | null;
  account_number: string | null;
  bank_sort_code: string | null;
  transfer_type: string;
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
  },
) {
  const raw = await request<{ success: boolean; data: AdminRemittanceTransactionsResult }>(
    `/api/v1/admins/remittance-transactions${buildQuery(params)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminRemittanceTransactionById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { transaction: AdminRemittanceTransactionRow } }>(
    `/api/v1/admins/remittance-transactions/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.transaction;
}

export type AdminBankListItem = {
  bankName: string;
  bankCode: string;
  operateTime: string | null;
};

export async function adminBanksList(accessToken: string) {
  const raw = await request<{ success: boolean; data: { banks: AdminBankListItem[] } }>(
    "/api/v1/admins/banks",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.banks;
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
    `/api/v1/admins/saved-recipients${buildQuery({
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
    "/api/v1/admins/saved-recipients",
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
    `/api/v1/admins/saved-recipients/${encodeURIComponent(id)}`,
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
    `/api/v1/admins/saved-recipients/${encodeURIComponent(id)}/active`,
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
    `/api/v1/admins/saved-recipients/${encodeURIComponent(id)}`,
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
    `/api/v1/admins/sms-notification-logs${buildQuery(params)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return raw.data;
}

export async function adminSmsNotificationLogById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { log: AdminSmsNotificationLogRow } }>(
    `/api/v1/admins/sms-notification-logs/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.log;
}

export async function adminSmsNotificationRetry(accessToken: string, id: string) {
  const raw = await request<{
    success: boolean;
    data: { queued: boolean; log: AdminSmsNotificationLogRow };
  }>(`/api/v1/admins/sms-notification-logs/${encodeURIComponent(id)}/retry`, {
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
  const raw = await request<{ success: boolean; data: SystemControlCenterOverview }>(
    "/api/v1/admins/system/overview",
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data;
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
    `/api/v1/admins/system/provider-logs/${encodeURIComponent(providerName)}${buildQuery({ limit })}`,
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
  }>("/api/v1/admins/system/service-providers", {
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
  }>(`/api/v1/admins/system/service-providers/${encodeURIComponent(id)}`, {
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
    `/api/v1/admins/system/service-providers/${encodeURIComponent(id)}`,
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
  }>(`/api/v1/admins/audit-logs${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export async function adminPlatformAuditLogById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { log: AdminPlatformAuditLogRow } }>(
    `/api/v1/admins/audit-logs/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.log;
}

export async function adminPlatformAuditAnomalies(accessToken: string) {
  const raw = await request<{
    success: boolean;
    data: {
      highTrafficIps: { ip_address: string; count: number }[];
      repeatedFailures: { action: string; count: number }[];
    };
  }>("/api/v1/admins/audit-logs/anomalies", {
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
  }>(`/api/v1/admins/remittance-admin-audit${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export async function adminRemittanceAuditLogById(accessToken: string, id: string) {
  const raw = await request<{ success: boolean; data: { log: AdminRemittanceAuditLogRow } }>(
    `/api/v1/admins/remittance-admin-audit/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return raw.data.log;
}

/** user_profiles + LEFT JOIN cybrid_customers (admin directory) */
export type AdminUserDirectoryRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  verification_status: string | null;
  is_verified: boolean;
  is_active: boolean;
  onboarding_completed: boolean | null;
  last_login_at: string | null;
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
    cybrid?: "linked" | "not_linked";
  },
) {
  const raw = await request<{
    success: boolean;
    data: {
      users: AdminUserDirectoryRow[];
      pagination: { limit: number; offset: number; total: number };
    };
  }>(`/api/v1/admins/users${buildQuery(params)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}

export type AdminUserDetailResponse = {
  profile: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    verification_status: string | null;
    is_verified: boolean;
    is_active: boolean;
    onboarding_completed: boolean | null;
    onboarding_step: number | null;
    last_login: string | null;
    last_login_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    cybrid_integration_completed: boolean | null;
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
    `/api/v1/admins/users/${encodeURIComponent(userId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
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
    `/api/v1/admins/users/${encodeURIComponent(userId)}/trading-snapshot`,
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
    `/api/v1/admins/users/${encodeURIComponent(userId)}/borapay-book-balance`,
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
    "/api/v1/admins/transfers/book",
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
  body: { user_ids: string[]; deliver_amount_usd: number; idempotency_key?: string },
) {
  const raw = await request<{ success: boolean; data: AdminBatchOpResult }>(
    "/api/v1/admins/trades",
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
    "/api/v1/admins/withdrawals/platform-wallet",
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
    "/api/v1/admins/withdrawals/platform-trading-balance",
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
    "/api/v1/admins/withdrawals",
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
  }>(`/api/v1/admins/operations${buildQuery(params ?? {})}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return raw.data;
}
