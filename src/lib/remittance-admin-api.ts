/**
 * Remittance API — dashboard admin auth (/api/v1/admins/*).
 * Base URL: NEXT_PUBLIC_REMITTANCE_API_URL (e.g. http://localhost:9002).
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
