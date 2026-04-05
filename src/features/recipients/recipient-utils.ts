import { formatDistanceToNow } from "date-fns";

/** Regional indicator symbols → flag emoji from ISO 3166-1 alpha-2 */
export function countryFlagEmoji(countryCode: string | null | undefined): string {
  const cc = (countryCode || "").trim().toUpperCase();
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return "🌍";
  const riA = 0x1f1e6;
  return String.fromCodePoint(
    riA + cc.charCodeAt(0) - 65,
    riA + cc.charCodeAt(1) - 65,
  );
}

export function maskAccountNumber(raw: string | null | undefined): string {
  const s = (raw || "").replace(/\s/g, "");
  if (!s) return "—";
  if (s.length <= 4) return `****${s}`;
  return `****${s.slice(-4)}`;
}

export function relativeLastUsed(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Uganda-oriented normalization: strip spaces, leading 0, ensure 256... */
export function normalizePhoneForSave(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 9 && /^7\d{8}$/.test(d)) d = `256${d}`;
  return d;
}

export function isRecentUse(iso: string | null | undefined, withinHours = 48): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < withinHours * 60 * 60 * 1000;
}
