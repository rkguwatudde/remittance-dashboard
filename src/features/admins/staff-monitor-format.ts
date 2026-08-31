import { format, formatDistanceToNow } from "date-fns";

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatExactUtc(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${format(date, "MMM d, yyyy HH:mm")} UTC`;
}

export function parseClientLabel(ua?: string | null): string {
  if (!ua?.trim()) return "—";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export function staffActionLabel(action: string): string {
  const labels: Record<string, string> = {
    STAFF_LOGIN_SUCCESS: "Signed in",
    STAFF_LOGOUT: "Signed out",
    STAFF_LOGIN_FAIL: "Failed sign-in",
    STAFF_ACCOUNT_LOCKED: "Account locked",
    STAFF_CREATED: "Invited admin",
    STAFF_UPDATED: "Account updated",
    STAFF_SESSIONS_REVOKED: "Forced sign-out",
    STAFF_REFRESH_REUSE_DETECTED: "Session reuse blocked",
    STAFF_PASSWORD_CHANGED: "Password changed",
    STAFF_LOGIN_OTP_SENT: "OTP sent",
  };
  return labels[action] ?? action.replace(/^STAFF_/, "").replace(/_/g, " ").toLowerCase();
}

export function roleLabel(role: string): string {
  return role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function emailInitials(email: string): string {
  const base = email.split("@")[0] ?? "?";
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}
