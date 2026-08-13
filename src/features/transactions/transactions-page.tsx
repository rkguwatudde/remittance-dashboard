"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AdminApiError,
  adminRemittanceTransactions,
  type AdminRemittanceTransactionRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { TransactionDetailDrawer } from "./transaction-detail-drawer";
import {
  formatFundingListLabel,
  fundingBadgeVariant,
  resolveFundingView,
} from "./funding-presentation";

const PAGE_SIZE = 25;
const EXPORT_CAP = 5000;

const STATUS_OPTIONS = [
  "QUEUED",
  "INITIATED",
  "PROCESSING",
  "PENDING_PROVIDER",
  "SUCCESS",
  "FAILED",
  "TIMEOUT",
] as const;

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatRecipient(row: AdminRemittanceTransactionRow): string {
  if (row.transfer_type === "bank" && row.account_number?.trim()) {
    const acct = row.account_number.trim();
    return acct.length > 6 ? `…${acct.slice(-6)}` : acct;
  }
  return row.phone_number?.trim() || "—";
}

function statusBadgeVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "success";
  if (s === "FAILED" || s === "TIMEOUT") return "destructive";
  if (s === "QUEUED" || s === "INITIATED" || s === "PROCESSING" || s === "PENDING_PROVIDER") {
    return "warning";
  }
  return "secondary";
}

function formatLedgerAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || !currency?.trim()) return "—";
  const code = currency.trim().toUpperCase();
  const zeroFraction = code === "UGX" || code === "KES" || code === "TZS";
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: zeroFraction ? 0 : 2,
    minimumFractionDigits: 0,
  })} ${code}`;
}

function formatRemittanceAmount(row: AdminRemittanceTransactionRow): string {
  if (row.amount_receive != null && row.currency_receive) {
    return formatLedgerAmount(row.amount_receive, row.currency_receive);
  }
  return formatLedgerAmount(row.amount, row.currency);
}

function formatBond(row: AdminRemittanceTransactionRow): string {
  if (row.bond_amount_usd == null) return "—";
  return `$${row.bond_amount_usd.toFixed(2)}`;
}

function formatFees(row: AdminRemittanceTransactionRow): string {
  const parts: string[] = [];
  if (row.fee_basis_points != null) {
    parts.push(`${(row.fee_basis_points / 100).toFixed(2)}%`);
  }
  if (row.fee_charges != null) {
    parts.push(`$${row.fee_charges}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

function FundingCell({ row }: { row: AdminRemittanceTransactionRow }) {
  const funding = resolveFundingView(row);
  return (
    <Badge variant={fundingBadgeVariant(funding.kind)} className="whitespace-nowrap">
      {funding.kind === "unknown" ? "—" : funding.label}
    </Badge>
  );
}

export function TransactionsPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [rows, setRows] = React.useState<AdminRemittanceTransactionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<AdminRemittanceTransactionRow | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const [sort, setSort] = React.useState<"created_at_desc" | "created_at_asc">("created_at_desc");
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [statusSel, setStatusSel] = React.useState<Set<string>>(new Set());
  const [amountMin, setAmountMin] = React.useState("");
  const [amountMax, setAmountMax] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 400);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const buildQuery = React.useCallback(
    (off: number) => {
      const status =
        statusSel.size > 0 ? Array.from(statusSel).sort().join(",") : undefined;
      return {
        limit: PAGE_SIZE,
        offset: off,
        sort,
        q: q || undefined,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        status,
        amount_min: amountMin.trim() || undefined,
        amount_max: amountMax.trim() || undefined,
      };
    },
    [sort, q, dateFrom, dateTo, statusSel, amountMin, amountMax],
  );

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError("Sign in to load transactions.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminRemittanceTransactions(token, buildQuery(offset));
      setRows(res.transactions);
      setTotal(res.pagination.total);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          const next = getAccessToken();
          if (next) {
            const res = await adminRemittanceTransactions(next, buildQuery(offset));
            setRows(res.transactions);
            setTotal(res.pagination.total);
            setLoading(false);
            return;
          }
        }
      }
      setError(err instanceof AdminApiError ? err.message : "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, refreshAccessToken, buildQuery, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const toggleStatus = (s: string) => {
    setOffset(0);
    setStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearFilters = () => {
    setOffset(0);
    setDateFrom("");
    setDateTo("");
    setStatusSel(new Set());
    setAmountMin("");
    setAmountMax("");
    setQInput("");
    setQ("");
  };

  const exportCsv = async () => {
    const token = getAccessToken();
    if (!token) return;
    setExporting(true);
    try {
      const collected: AdminRemittanceTransactionRow[] = [];
      let off = 0;
      const status =
        statusSel.size > 0 ? Array.from(statusSel).sort().join(",") : undefined;
      const base = {
        limit: 100,
        sort,
        q: q || undefined,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        status,
        amount_min: amountMin.trim() || undefined,
        amount_max: amountMax.trim() || undefined,
      };
      while (collected.length < EXPORT_CAP) {
        const res = await adminRemittanceTransactions(token, { ...base, offset: off });
        collected.push(...res.transactions);
        if (res.transactions.length < 100 || collected.length >= res.pagination.total) break;
        off += 100;
      }
      const headers = [
        "created_at",
        "customer_email",
        "remittance_amount",
        "funding_method",
        "funding_label",
        "funding_rail",
        "bond_usd",
        "fees",
        "payout_status",
        "recipient",
        "narration",
        "internal_status",
        "transaction_ref",
        "platform_transaction_id",
      ];
      const lines = [headers.join(",")];
      for (const r of collected) {
        const funding = resolveFundingView(r);
        lines.push(
          [
            csvEscape(format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")),
            csvEscape(r.customer_email ?? ""),
            csvEscape(formatRemittanceAmount(r)),
            csvEscape(r.funding_method ?? funding.kind),
            csvEscape(formatFundingListLabel(funding)),
            csvEscape(r.funding_rail ?? r.cybrid_transaction_status ?? ""),
            csvEscape(formatBond(r)),
            csvEscape(formatFees(r)),
            csvEscape(r.payout_provider_status ?? ""),
            csvEscape(
              r.transfer_type === "bank"
                ? (r.account_number ?? "").trim()
                : (r.phone_number ?? "").trim(),
            ),
            csvEscape(r.narration ?? ""),
            csvEscape(r.status),
            csvEscape(r.transaction_ref),
            csvEscape(r.platform_transaction_id ?? ""),
          ].join(","),
        );
      }
      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `remittance-transactions-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        await refreshAccessToken();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Filterable remittance ledger with funding method, Cybrid rail, and payout context.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={exporting || loading}
            onClick={() => void exportCsv()}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search email, phone, platform ID, ref…"
                className="h-10 border-transparent bg-surface-muted pl-9 focus-visible:bg-surface"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={filtersOpen ? "default" : "secondary"}
                size="sm"
                className="gap-2"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
                <span className="text-muted-foreground">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as "created_at_desc" | "created_at_asc");
                    setOffset(0);
                  }}
                  className="rounded bg-transparent text-sm font-medium text-foreground outline-none"
                >
                  <option value="created_at_desc">Newest first</option>
                  <option value="created_at_asc">Oldest first</option>
                </select>
              </div>
            </div>
          </div>

          {filtersOpen ? (
            <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Date from</p>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setOffset(0);
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Date to</p>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setOffset(0);
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Amount min (local)</p>
                <Input
                  inputMode="decimal"
                  value={amountMin}
                  onChange={(e) => {
                    setAmountMin(e.target.value);
                    setOffset(0);
                  }}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Amount max (local)</p>
                <Input
                  inputMode="decimal"
                  value={amountMax}
                  onChange={(e) => {
                    setAmountMax(e.target.value);
                    setOffset(0);
                  }}
                  placeholder="—"
                  className="h-9"
                />
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        statusSel.has(s)
                          ? "border-primary bg-primary-muted text-primary"
                          : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Date / time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Remittance</th>
                <th className="px-4 py-3">Funding</th>
                <th className="px-4 py-3">Bond</th>
                <th className="px-4 py-3">Fees</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Narration</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full max-w-[8rem]" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-surface-muted/60"
                      onClick={() => {
                        setSelected(row);
                        setDrawerOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(row);
                          setDrawerOpen(true);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {format(new Date(row.created_at), "MMM d, HH:mm")}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-foreground" title={row.customer_email ?? ""}>
                        {row.customer_email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-foreground">
                        {formatRemittanceAmount(row)}
                      </td>
                      <td className="px-4 py-3">
                        <FundingCell row={row} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {formatBond(row)}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-muted-foreground" title={formatFees(row)}>
                        {formatFees(row)}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground" title={row.payout_provider_status ?? ""}>
                        {row.payout_provider_status ?? "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-foreground" title={formatRecipient(row)}>
                        {formatRecipient(row)}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground" title={row.narration ?? ""}>
                        {row.narration ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(row.status)} className="whitespace-nowrap capitalize">
                          {row.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{total}</span>
            {pageCount > 1 ? (
              <span className="text-muted-foreground">
                {" "}
                · Page {page} / {pageCount}
              </span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <TransactionDetailDrawer
        open={drawerOpen}
        transaction={selected}
        onClose={() => setDrawerOpen(false)}
        onFullyClosed={() => setSelected(null)}
      />
    </div>
  );
}
