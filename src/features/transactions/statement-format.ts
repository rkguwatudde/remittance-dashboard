import { endOfMonth, format, startOfMonth } from "date-fns";

import type { AdminRemittanceTransactionRow } from "@/lib/remittance-admin-api";

export const STATEMENT_TAGLINE = "Remittances + Investment, in one App";
export const STATEMENT_DISCLAIMER =
  "This statement is generated electronically by BoraBond and is provided for informational and record-keeping purposes.";

export type StatementStatusKind =
  | "completed"
  | "pending"
  | "failed"
  | "cancelled"
  | "reversed"
  | "other";

export type StatementCurrencyTotal = {
  currency: string;
  amount: number;
};

export type StatementSummary = {
  totalTransactions: number;
  sent: StatementCurrencyTotal[];
  received: StatementCurrencyTotal[];
  fees: StatementCurrencyTotal[];
  investedUsd: number | null;
};

export function monthBounds(year: number, monthIndex: number): { from: Date; to: Date } {
  const seed = new Date(year, monthIndex, 1);
  return { from: startOfMonth(seed), to: endOfMonth(seed) };
}

export function monthRangeIso(year: number, monthIndex: number): { dateFrom: string; dateTo: string } {
  const { from, to } = monthBounds(year, monthIndex);
  return {
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
  };
}

export function formatStatementPeriod(year: number, monthIndex: number): string {
  const { from, to } = monthBounds(year, monthIndex);
  return `${format(from, "MMMM d, yyyy")} – ${format(to, "MMMM d, yyyy")}`;
}

export function formatLedgerAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || !currency?.trim()) return "—";
  const code = currency.trim().toUpperCase();
  const zeroFraction = code === "UGX" || code === "KES" || code === "TZS";
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: zeroFraction ? 0 : 2,
    minimumFractionDigits: zeroFraction ? 0 : 2,
  })} ${code}`;
}

export function formatRemittanceAmount(row: AdminRemittanceTransactionRow): string {
  if (row.amount_receive != null && row.currency_receive) {
    return formatLedgerAmount(row.amount_receive, row.currency_receive);
  }
  return formatLedgerAmount(row.amount, row.currency);
}

export function formatFeeAmount(row: AdminRemittanceTransactionRow): string {
  if (row.fee_charges == null) return "—";
  return formatLedgerAmount(row.fee_charges, "USD");
}

export function formatSendTotal(row: AdminRemittanceTransactionRow): string {
  if (row.amount_send != null && row.currency_send) {
    return formatLedgerAmount(row.amount_send, row.currency_send);
  }
  return formatLedgerAmount(row.amount, row.currency);
}

/** Locked conversion_rate, or implied receive÷send when the snapshot is missing. */
export function resolveExchangeRate(row: AdminRemittanceTransactionRow): number | null {
  const locked = Number(row.conversion_rate);
  if (Number.isFinite(locked) && locked > 0) return locked;
  const send = row.amount_send;
  const receive = row.amount_receive ?? row.amount;
  if (send == null || receive == null || send <= 0 || receive <= 0) return null;
  const implied = receive / send;
  return Number.isFinite(implied) && implied > 0 ? implied : null;
}

export function formatExchangeRate(row: AdminRemittanceTransactionRow): string {
  const rate = resolveExchangeRate(row);
  if (rate == null) return "—";
  const decimals = rate >= 100 ? 2 : rate >= 1 ? 4 : 6;
  return rate.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatStatementDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy HH:mm");
}

export function transferTypeLabel(type: string | null | undefined): string {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "mobile_money") return "Mobile money";
  if (t === "bank") return "Bank";
  if (!t) return "—";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statementStatus(status: string | null | undefined): {
  label: string;
  kind: StatementStatusKind;
} {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "SUCCESS" || s === "COMPLETED") return { label: "Completed", kind: "completed" };
  if (s === "FAILED" || s === "TIMEOUT") return { label: "Failed", kind: "failed" };
  if (s === "CANCELLED" || s === "CANCELED") return { label: "Cancelled", kind: "cancelled" };
  if (s === "REVERSED" || s === "REVERSAL") return { label: "Reversed", kind: "reversed" };
  if (
    s === "QUEUED" ||
    s === "INITIATED" ||
    s === "PROCESSING" ||
    s === "PENDING_PROVIDER" ||
    s === "PARTIAL_FAILURE"
  ) {
    return { label: "Pending", kind: "pending" };
  }
  if (!s) return { label: "—", kind: "other" };
  return {
    label: s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    kind: "other",
  };
}

export function transactionId(row: AdminRemittanceTransactionRow): string {
  return row.transaction_ref?.trim() || row.platform_transaction_id?.trim() || row.id;
}

export function transactionDescription(row: AdminRemittanceTransactionRow): string {
  const recipient = row.recipient_name?.trim();
  const dest =
    row.transfer_type === "bank"
      ? row.account_number?.trim()
      : row.phone_number?.trim();
  const narration = row.narration?.trim();
  const parts = [recipient, dest ? `to ${dest}` : null, narration].filter(Boolean);
  return parts.length ? parts.join(" · ") : transferTypeLabel(row.transfer_type);
}

export function ellipsize(value: string, max: number): string {
  const v = value.trim();
  if (v.length <= max) return v;
  if (max < 8) return `${v.slice(0, max)}…`;
  return `${v.slice(0, Math.max(4, max - 7))}…${v.slice(-4)}`;
}

export function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60) || "Customer";
}

export function statementFilename(customerName: string, year: number, monthIndex: number): string {
  const month = format(new Date(year, monthIndex, 1), "MMMM_yyyy");
  return `BoraBond_Transaction_Statement_${sanitizeFilenamePart(customerName)}_${month}.pdf`;
}

function addCurrency(map: Map<string, number>, amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null || !currency?.trim()) return;
  const code = currency.trim().toUpperCase();
  map.set(code, (map.get(code) ?? 0) + amount);
}

function toTotals(map: Map<string, number>): StatementCurrencyTotal[] {
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildStatementSummary(rows: AdminRemittanceTransactionRow[]): StatementSummary {
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  const fees = new Map<string, number>();
  let invested = 0;
  let hasInvested = false;

  for (const row of rows) {
    addCurrency(sent, row.amount_send, row.currency_send);
    if (row.amount_send == null) {
      addCurrency(sent, row.amount, row.currency);
    }
    addCurrency(received, row.amount_receive, row.currency_receive);
    if (row.fee_charges != null) {
      addCurrency(fees, row.fee_charges, "USD");
    }
    if (row.bond_amount_usd != null) {
      invested += row.bond_amount_usd;
      hasInvested = true;
    }
  }

  return {
    totalTransactions: rows.length,
    sent: toTotals(sent),
    received: toTotals(received),
    fees: toTotals(fees),
    investedUsd: hasInvested ? invested : null,
  };
}

export function formatCurrencyTotals(totals: StatementCurrencyTotal[]): string {
  if (!totals.length) return "—";
  return totals.map((t) => formatLedgerAmount(t.amount, t.currency)).join("  ·  ");
}
