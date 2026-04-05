import { formatDistanceToNow } from "date-fns";

/** Display helper for SMS audit — does not validate; DB stores normalized digits. */
export function formatSmsPhoneDisplay(raw: string | null | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.startsWith("256") && d.length >= 12) {
    const rest = d.slice(3);
    const parts =
      rest.length >= 9
        ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 9), rest.slice(9)]
        : [rest];
    return `+256 ${parts.filter(Boolean).join(" ")}`;
  }
  if (d.length >= 10) {
    return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return `+${d}`;
}

export function truncateMessage(s: string, max = 72): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function relativeSmsTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export type SmsQuickFilter = "all" | "failed" | "sending" | "sent" | "invalid";

export function quickFilterToStatusParam(
  q: SmsQuickFilter,
): string | undefined {
  switch (q) {
    case "failed":
      return "FAILED";
    case "sending":
      return "SENDING";
    case "sent":
      return "SENT";
    case "invalid":
      return "SKIPPED_INVALID_PHONE";
    default:
      return undefined;
  }
}

export function activitySortPriority(status: string): number {
  const s = status.toUpperCase();
  if (s === "FAILED") return 0;
  if (s === "SENDING") return 1;
  if (s === "SKIPPED_INVALID_PHONE") return 2;
  if (s === "SENT") return 3;
  return 4;
}
