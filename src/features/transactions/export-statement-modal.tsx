"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { FileText, Loader2, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import {
  AdminApiError,
  adminUsersList,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { fetchMonthlyStatementTransactions, previewMonthlyStatementCount } from "./statement-data";
import {
  formatStatementPeriod,
  statementFilename,
} from "./statement-format";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function yearOptions(preferred?: number): number[] {
  const now = new Date().getFullYear();
  const years = new Set<number>();
  for (let y = now + 1; y >= now - 6; y -= 1) years.add(y);
  if (preferred && preferred > 2000 && preferred < 2100) years.add(preferred);
  return Array.from(years).sort((a, b) => b - a);
}

async function loadBrandLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/brand/borabond-mark.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ExportStatementModalProps = {
  open: boolean;
  defaultMonth?: number;
  defaultYear?: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function ExportStatementModal({
  open,
  defaultMonth,
  defaultYear,
  onClose,
  onSuccess,
  onError,
}: ExportStatementModalProps) {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const now = new Date();
  const [month, setMonth] = React.useState(defaultMonth ?? now.getMonth());
  const [year, setYear] = React.useState(defaultYear ?? now.getFullYear());
  const [userQuery, setUserQuery] = React.useState("");
  const [userHits, setUserHits] = React.useState<AdminUserDirectoryRow[]>([]);
  const [userLoading, setUserLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<AdminUserDirectoryRow | null>(null);
  const [previewCount, setPreviewCount] = React.useState<number | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [emptyMessage, setEmptyMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth ?? new Date().getMonth());
    setYear(defaultYear ?? new Date().getFullYear());
    setSelected(null);
    setUserQuery("");
    setUserHits([]);
    setPreviewCount(null);
    setEmptyMessage(null);
    setExporting(false);
  }, [open, defaultMonth, defaultYear]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, exporting, onClose]);

  const withToken = React.useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      const ok = await refreshAccessToken();
      token = ok ? getAccessToken() : null;
    }
    return token;
  }, [getAccessToken, refreshAccessToken]);

  React.useEffect(() => {
    if (!open || selected) return;
    const q = userQuery.trim();
    const t = window.setTimeout(async () => {
      const token = await withToken();
      if (!token) return;
      setUserLoading(true);
      try {
        const data = await adminUsersList(token, {
          q: q || undefined,
          limit: 8,
          offset: 0,
        });
        setUserHits(data.users);
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          await refreshAccessToken();
        }
        setUserHits([]);
      } finally {
        setUserLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [open, selected, userQuery, withToken, refreshAccessToken]);

  React.useEffect(() => {
    if (!open || !selected) {
      setPreviewCount(null);
      setEmptyMessage(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const token = await withToken();
      if (!token || cancelled) return;
      setPreviewing(true);
      setEmptyMessage(null);
      try {
        const count = await previewMonthlyStatementCount(token, {
          userId: selected.user_id,
          year,
          monthIndex: month,
        });
        if (cancelled) return;
        setPreviewCount(count);
        setEmptyMessage(count === 0 ? "No transactions found for this period." : null);
      } catch (err) {
        if (cancelled) return;
        setPreviewCount(null);
        setEmptyMessage(err instanceof AdminApiError ? err.message : "Could not preview this period.");
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, selected, year, month, withToken]);

  const exportPdf = async () => {
    if (!selected) {
      onError("Select a customer before exporting.");
      return;
    }
    const token = await withToken();
    if (!token) {
      onError("Sign in to export a statement.");
      return;
    }
    setExporting(true);
    setEmptyMessage(null);
    try {
      const { rows } = await fetchMonthlyStatementTransactions(token, {
        userId: selected.user_id,
        year,
        monthIndex: month,
      });
      if (rows.length === 0) {
        setPreviewCount(0);
        setEmptyMessage("No transactions found for this period.");
        return;
      }
      setPreviewCount(rows.length);
      const [{ pdf }, { StatementDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./statement-document"),
      ]);
      const logoSrc = await loadBrandLogoDataUrl();
      const customerName = selected.full_name?.trim() || selected.email?.trim() || "Customer";
      const blob = await pdf(
        <StatementDocument
          customer={{
            name: customerName,
            email: selected.email?.trim() || rows[0]?.customer_email?.trim() || "—",
            customerId: selected.user_id,
          }}
          periodLabel={formatStatementPeriod(year, month)}
          generatedAt={format(new Date(), "MMMM d, yyyy HH:mm")}
          rows={rows}
          logoSrc={logoSrc}
        />,
      ).toBlob();
      downloadBlob(blob, statementFilename(customerName, year, month));
      onSuccess(`Statement downloaded for ${customerName} · ${MONTHS[month]} ${year}.`);
      onClose();
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        await refreshAccessToken();
      }
      onError(err instanceof AdminApiError ? err.message : "Could not generate the PDF statement.");
    } finally {
      setExporting(false);
    }
  };

  if (!mounted) return null;

  const periodLabel = formatStatementPeriod(year, month);
  const canExport = Boolean(selected) && !exporting && !previewing && previewCount !== 0;

  const dialog = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-foreground/25 backdrop-blur-[1px]"
            onClick={() => {
              if (!exporting) onClose();
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-statement-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="export-statement-title" className="text-base font-semibold text-foreground">
                  Export monthly statement
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate a BoraBond PDF for one customer and calendar month.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close export dialog"
                disabled={exporting}
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="statement-user">
                  Customer
                </label>
                {selected ? (
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selected.full_name || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{selected.email || "No email"}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {selected.user_id}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={exporting}
                      onClick={() => {
                        setSelected(null);
                        setPreviewCount(null);
                        setEmptyMessage(null);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="statement-user"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Search name, email, or user id…"
                        className="h-10 pl-9"
                        autoComplete="off"
                        disabled={exporting}
                      />
                    </div>
                    <div className="max-h-44 overflow-auto rounded-xl border border-border bg-surface">
                      {userLoading ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">Searching customers…</p>
                      ) : userHits.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">
                          No customers match that search.
                        </p>
                      ) : (
                        <ul>
                          {userHits.map((u) => (
                            <li key={u.user_id}>
                              <button
                                type="button"
                                className="flex w-full flex-col items-start gap-0.5 border-b border-border/70 px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-muted/80"
                                onClick={() => setSelected(u)}
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {u.full_name || "—"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {[u.email, u.phone].filter(Boolean).join(" · ") || u.user_id}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="statement-month">
                    Month
                  </label>
                  <select
                    id="statement-month"
                    value={month}
                    disabled={exporting}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {MONTHS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="statement-year">
                    Year
                  </label>
                  <select
                    id="statement-year"
                    value={year}
                    disabled={exporting}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {yearOptions(year).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm",
                  emptyMessage
                    ? "border-warning/40 bg-warning-muted/20 text-foreground"
                    : "border-border bg-surface-muted/50 text-muted-foreground",
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Period
                </p>
                <p className="mt-0.5 text-foreground">{periodLabel}</p>
                {previewing ? (
                  <p className="mt-1 inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Counting transactions…
                  </p>
                ) : emptyMessage ? (
                  <p className="mt-1">{emptyMessage}</p>
                ) : previewCount != null ? (
                  <p className="mt-1">
                    <span className="font-semibold text-foreground">{previewCount}</span> transaction
                    {previewCount === 1 ? "" : "s"} will be included.
                  </p>
                ) : (
                  <p className="mt-1">Select a customer to preview the statement count.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={exporting} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={!canExport}
                onClick={() => void exportPdf()}
              >
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {exporting ? "Generating PDF…" : "Export PDF"}
              </Button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(dialog, document.body);
}
