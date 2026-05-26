"use client";

import * as React from "react";
import {
  adminLogout,
  adminRefresh,
  type AdminVerifyOtpResponse,
} from "@/lib/remittance-admin-api";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  /** Short label for UI */
  displayRole: string;
};

export type StoredAdminSession = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  admin: { id: string; email: string; role: string };
  passwordResetRequired?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  isReady: boolean;
  passwordResetRequired: boolean;
  /** Apply tokens after successful 2FA */
  completeSignIn: (result: AdminVerifyOtpResponse) => void;
  clearPasswordResetRequired: () => void;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
};

const STORAGE_KEY = "borabond_ops_admin_session";

function formatDisplayRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function toAuthUser(admin: { id: string; email: string; role: string }): AuthUser {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    displayRole: formatDisplayRole(admin.role),
  };
}

function readSession(): StoredAdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAdminSession;
  } catch {
    return null;
  }
}

function writeSession(s: StoredAdminSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [passwordResetRequired, setPasswordResetRequired] = React.useState(false);

  const getAccessToken = React.useCallback(() => readSession()?.accessToken ?? null, []);

  const refreshAccessToken = React.useCallback(async (): Promise<boolean> => {
    const s = readSession();
    if (!s?.refreshToken) return false;
    try {
      const next = await adminRefresh(s.refreshToken);
      const accessExpiresAt = Date.now() + next.expires_in * 1000;
      const resetRequired = !!next.password_reset_required;
      writeSession({
        accessToken: next.access_token,
        refreshToken: next.refresh_token,
        accessExpiresAt,
        admin: next.admin,
        passwordResetRequired: resetRequired,
      });
      setUser(toAuthUser(next.admin));
      setPasswordResetRequired(resetRequired);
      return true;
    } catch {
      return false;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = readSession();
      if (!s) {
        if (!cancelled) setIsReady(true);
        return;
      }

      const skewMs = 120_000;
      if (Date.now() < s.accessExpiresAt - skewMs) {
        if (!cancelled) {
          setUser(toAuthUser(s.admin));
          setPasswordResetRequired(!!s.passwordResetRequired);
          setIsReady(true);
        }
        return;
      }

      const ok = await refreshAccessToken();
      if (cancelled) return;
      if (!ok) {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setPasswordResetRequired(false);
      }
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken]);

  const completeSignIn = React.useCallback((result: AdminVerifyOtpResponse) => {
    const accessExpiresAt = Date.now() + result.expires_in * 1000;
    const resetRequired = !!result.password_reset_required;
    const stored: StoredAdminSession = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accessExpiresAt,
      admin: result.admin,
      passwordResetRequired: resetRequired,
    };
    writeSession(stored);
    setUser(toAuthUser(result.admin));
    setPasswordResetRequired(resetRequired);
  }, []);

  const clearPasswordResetRequired = React.useCallback(() => {
    const s = readSession();
    if (s) {
      writeSession({ ...s, passwordResetRequired: false });
    }
    setPasswordResetRequired(false);
  }, []);

  const signOut = React.useCallback(async () => {
    const s = readSession();
    if (s?.accessToken) {
      try {
        await adminLogout(s.accessToken, s.refreshToken);
      } catch {
        /* still clear locally */
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setPasswordResetRequired(false);
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isReady,
      passwordResetRequired,
      completeSignIn,
      clearPasswordResetRequired,
      signOut,
      getAccessToken,
      refreshAccessToken,
    }),
    [
      user,
      isReady,
      passwordResetRequired,
      completeSignIn,
      clearPasswordResetRequired,
      signOut,
      getAccessToken,
      refreshAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
