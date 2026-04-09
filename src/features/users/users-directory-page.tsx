"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminOperationsList,
  adminTradeBatch,
  adminTransferBook,
  adminUserBorapayBookBalance,
  adminUsersList,
  adminWithdrawBatch,
  adminWithdrawPlatformTradingBalance,
  adminWithdrawPlatformWallet,
  type AdminBorapayBookBalance,
  type AdminWithdrawPlatformTradingBalance,
  type AdminWithdrawPlatformWallet,
  type AdminOperationLogRow,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { CybridLinkStatusBadge, UserStatusBadge } from "./user-badges";
import { UserDetailDrawer } from "./user-detail-drawer";
import { cn } from "@/lib/utils";

export type UsersDirectoryPageProps = {
  /** When true, show selection, bulk Cybrid actions, and recent operations log. */
  transferHub?: boolean;
};

export function UsersDirectoryPage({ transferHub = false }: UsersDirectoryPageProps) {
  const { getAccessToken } = useAuth();
  const token = getAccessToken();

  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  const [verified, setVerified] = React.useState<boolean | undefined>(undefined);
  const [active, setActive] = React.useState<boolean | undefined>(undefined);
  const [cybrid, setCybrid] = React.useState<"linked" | "not_linked" | undefined>(undefined);
  const [offset, setOffset] = React.useState(0);
  const limit = 50;
  const [rows, setRows] = React.useState<AdminUserDirectoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  /** Start optimistic when already authenticated to avoid an empty-state flash before the first fetch. */
  const [loading, setLoading] = React.useState(() => Boolean(getAccessToken()));
  const [err, setErr] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [detailUserId, setDetailUserId] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [panelAction, setPanelAction] = React.useState<"book" | "trade" | "withdraw" | null>(null);
  const [bookAmount, setBookAmount] = React.useState("");
  const [tradeUsd, setTradeUsd] = React.useState("");
  const [withdrawMinor, setWithdrawMinor] = React.useState("");
  const [withdrawPlatformWallet, setWithdrawPlatformWallet] =
    React.useState<AdminWithdrawPlatformWallet | null>(null);
  const [withdrawPlatformLoading, setWithdrawPlatformLoading] = React.useState(false);
  const [withdrawPlatformErr, setWithdrawPlatformErr] = React.useState<string | null>(null);
  const [withdrawTradingPreview, setWithdrawTradingPreview] =
    React.useState<AdminWithdrawPlatformTradingBalance | null>(null);
  const [withdrawTradingLoading, setWithdrawTradingLoading] = React.useState(false);
  const [withdrawTradingErr, setWithdrawTradingErr] = React.useState<string | null>(null);
  const [batchRunning, setBatchRunning] = React.useState(false);
  const [batchSummary, setBatchSummary] = React.useState<string | null>(null);

  const [ops, setOps] = React.useState<AdminOperationLogRow[]>([]);
  const [opsLoading, setOpsLoading] = React.useState(false);
  const [opsErr, setOpsErr] = React.useState<string | null>(null);

  const [bookPreview, setBookPreview] = React.useState<AdminBorapayBookBalance | null>(null);
  const [bookPreviewLoading, setBookPreviewLoading] = React.useState(false);
  const [bookPreviewErr, setBookPreviewErr] = React.useState<string | null>(null);

  const openUserDetail = React.useCallback((userId: string) => {
    setDetailUserId(userId);
    setDrawerOpen(true);
  }, []);

  const load = React.useCallback(async () => {
    if (!token) {
      setErr("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await adminUsersList(token, {
        q: debouncedQ || undefined,
        limit,
        offset,
        verified,
        active,
        cybrid,
      });
      setRows(data.users);
      setTotal(data.pagination.total);
    } catch (e) {
      setErr(e instanceof AdminApiError ? e.message : "Failed to load users.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, debouncedQ, offset, verified, active, cybrid]);

  const loadOps = React.useCallback(async () => {
    if (!token || !transferHub) return;
    setOpsLoading(true);
    setOpsErr(null);
    try {
      const data = await adminOperationsList(token, { limit: 30, offset: 0 });
      setOps(data.operations);
    } catch (e) {
      setOpsErr(e instanceof AdminApiError ? e.message : "Failed to load operations.");
      setOps([]);
    } finally {
      setOpsLoading(false);
    }
  }, [token, transferHub]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    void loadOps();
  }, [loadOps]);

  React.useEffect(() => {
    setOffset(0);
  }, [debouncedQ, verified, active, cybrid]);

  React.useEffect(() => {
    if (!transferHub) setSelected(new Set());
  }, [transferHub]);

  React.useEffect(() => {
    if (transferHub) setSelected(new Set());
  }, [transferHub, debouncedQ, verified, active, cybrid]);

  const toggleOne = React.useCallback((userId: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  const allOnPageSelected =
    transferHub && rows.length > 0 && rows.every((r) => selected.has(r.user_id));
  const someOnPage = transferHub && rows.some((r) => selected.has(r.user_id));

  const toggleSelectAllPage = React.useCallback(() => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.user_id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.add(r.user_id));
        return next;
      });
    }
  }, [allOnPageSelected, rows]);

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);
  const singleSelectedUserId = selectedIds.length === 1 ? selectedIds[0] : null;

  React.useEffect(() => {
    if (!transferHub || panelAction !== "book" || !token) {
      setBookPreview(null);
      setBookPreviewErr(null);
      setBookPreviewLoading(false);
      return;
    }
    if (!singleSelectedUserId) {
      setBookPreview(null);
      setBookPreviewErr(null);
      setBookPreviewLoading(false);
      setBookAmount("");
      return;
    }

    let cancelled = false;
    setBookPreviewLoading(true);
    setBookPreviewErr(null);
    setBookPreview(null);

    void adminUserBorapayBookBalance(token, singleSelectedUserId)
      .then((d) => {
        if (cancelled) return;
        setBookPreview(d);
        setBookAmount(d.platform_balance_minor > 0 ? String(d.platform_balance_minor) : "");
      })
      .catch((e) => {
        if (cancelled) return;
        setBookPreview(null);
        setBookPreviewErr(e instanceof AdminApiError ? e.message : "Could not load BoraPay balance.");
        setBookAmount("");
      })
      .finally(() => {
        if (!cancelled) setBookPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transferHub, panelAction, token, singleSelectedUserId]);

  React.useEffect(() => {
    if (!transferHub || panelAction !== "withdraw" || !token) {
      setWithdrawPlatformWallet(null);
      setWithdrawPlatformErr(null);
      setWithdrawPlatformLoading(false);
      setWithdrawTradingPreview(null);
      setWithdrawTradingErr(null);
      setWithdrawTradingLoading(false);
      setWithdrawMinor("");
      return;
    }

    let cancelled = false;
    setWithdrawPlatformLoading(true);
    setWithdrawPlatformErr(null);
    setWithdrawPlatformWallet(null);

    void adminWithdrawPlatformWallet(token)
      .then((d) => {
        if (cancelled) return;
        setWithdrawPlatformWallet(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setWithdrawPlatformWallet(null);
        setWithdrawPlatformErr(
          e instanceof AdminApiError ? e.message : "Could not load Platform Wallet from Cybrid.",
        );
      })
      .finally(() => {
        if (!cancelled) setWithdrawPlatformLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transferHub, panelAction, token]);

  React.useEffect(() => {
    if (!transferHub || panelAction !== "withdraw" || !token) {
      return;
    }

    let cancelled = false;
    setWithdrawMinor("");
    setWithdrawTradingLoading(true);
    setWithdrawTradingErr(null);
    setWithdrawTradingPreview(null);

    void adminWithdrawPlatformTradingBalance(token)
      .then((d) => {
        if (cancelled) return;
        setWithdrawTradingPreview(d);
        setWithdrawMinor(
          d.platform_balance_minor > 0 ? String(d.platform_balance_minor) : "",
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setWithdrawTradingPreview(null);
        setWithdrawTradingErr(
          e instanceof AdminApiError
            ? e.message
            : "Could not load bank USDC_SOL trading balance from Cybrid.",
        );
      })
      .finally(() => {
        if (!cancelled) setWithdrawTradingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transferHub, panelAction, token]);

  const runBook = React.useCallback(async () => {
    if (!token || selectedIds.length === 0) return;
    setBatchRunning(true);
    setBatchSummary(null);
    try {
      const amount_cents =
        bookAmount.trim() === "" ? undefined : Number.parseInt(bookAmount, 10);
      if (bookAmount.trim() !== "" && (!Number.isFinite(amount_cents) || (amount_cents ?? 0) < 1)) {
        setBatchSummary("Enter a valid amount in cents, or leave empty to use full BoraPay USD balance.");
        return;
      }
      const data = await adminTransferBook(token, { user_ids: selectedIds, amount_cents });
      setBatchSummary(
        `Book transfer: ${data.success.length} ok, ${data.failed.length} failed.` +
          (data.failed.length
            ? ` Errors: ${data.failed.map((f) => `${f.user_id.slice(0, 8)}… ${f.error}`).join(" | ")}`
            : ""),
      );
      void loadOps();
      void load();
    } catch (e) {
      setBatchSummary(e instanceof AdminApiError ? e.message : "Book transfer request failed.");
    } finally {
      setBatchRunning(false);
    }
  }, [token, selectedIds, bookAmount, loadOps, load]);

  const runTrade = React.useCallback(async () => {
    if (!token) return;
    const usd = Number.parseFloat(tradeUsd);
    if (!Number.isFinite(usd) || usd < 0.01) {
      setBatchSummary("Enter deliver amount USD (min 0.01).");
      return;
    }
    setBatchRunning(true);
    setBatchSummary(null);
    try {
      const payload =
        selectedIds.length > 0
          ? { user_ids: selectedIds, deliver_amount_usd: usd }
          : { deliver_amount_usd: usd };
      const data = await adminTradeBatch(token, payload);
      setBatchSummary(
        `Trade: ${data.success.length} ok, ${data.failed.length} failed.` +
          (data.failed.length
            ? ` Errors: ${data.failed.map((f) => `${f.user_id.slice(0, 8)}… ${f.error}`).join(" | ")}`
            : ""),
      );
      void loadOps();
    } catch (e) {
      setBatchSummary(e instanceof AdminApiError ? e.message : "Trade request failed.");
    } finally {
      setBatchRunning(false);
    }
  }, [token, selectedIds, tradeUsd, loadOps]);

  const runWithdraw = React.useCallback(async () => {
    if (!token || selectedIds.length === 0) return;
    const minor = Number.parseInt(withdrawMinor, 10);
    if (!Number.isFinite(minor) || minor < 1) {
      setBatchSummary("Enter deliver_amount_minor (positive integer).");
      return;
    }
    if (!withdrawPlatformWallet?.guid) {
      setBatchSummary("Platform Wallet could not be resolved; fix Cybrid config or try again.");
      return;
    }
    setBatchRunning(true);
    setBatchSummary(null);
    try {
      const data = await adminWithdrawBatch(token, {
        user_ids: selectedIds,
        deliver_amount_minor: minor,
      });
      setBatchSummary(
        `Withdraw: ${data.success.length} ok, ${data.failed.length} failed.` +
          (data.failed.length
            ? ` Errors: ${data.failed.map((f) => `${f.user_id.slice(0, 8)}… ${f.error}`).join(" | ")}`
            : ""),
      );
      void loadOps();
    } catch (e) {
      setBatchSummary(e instanceof AdminApiError ? e.message : "Withdraw request failed.");
    } finally {
      setBatchRunning(false);
    }
  }, [token, selectedIds, withdrawMinor, withdrawPlatformWallet, loadOps]);

  const colCount = transferHub ? 8 : 7;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {transferHub ? "Cybrid" : "Directory"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {transferHub ? "Transfers" : "Users"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {transferHub
            ? "Select users, then run Book transfer (BoraPay → platform), Trade, or Withdraw independently. Book uses quote + transfer on the server."
            : "user_profiles is the source of truth. Cybrid linkage is shown for integration status."}
        </p>
      </header>

      {transferHub ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
              {batchRunning ? " · Processing…" : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant={panelAction === "book" ? "default" : "secondary"}
              disabled={batchRunning}
              onClick={() => setPanelAction((p) => (p === "book" ? null : "book"))}
            >
              Book transfer
            </Button>
            <Button
              type="button"
              size="sm"
              variant={panelAction === "trade" ? "default" : "secondary"}
              disabled={batchRunning}
              onClick={() => setPanelAction((p) => (p === "trade" ? null : "trade"))}
            >
              Trade
            </Button>
            <Button
              type="button"
              size="sm"
              variant={panelAction === "withdraw" ? "default" : "secondary"}
              disabled={batchRunning}
              onClick={() => setPanelAction((p) => (p === "withdraw" ? null : "withdraw"))}
            >
              Withdraw
            </Button>
          </div>

          {panelAction === "book" ? (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {selectedIds.length !== 1 ? (
                <p className="text-sm text-muted-foreground">
                  Select <span className="font-medium text-foreground">one user</span> to load BoraPay{" "}
                  <span className="font-medium text-foreground">platform balance</span> into the amount field. With
                  multiple users, leave the amount empty to transfer each user&apos;s full BoraPay USD balance, or
                  enter cents to cap each transfer.
                </p>
              ) : null}
              {bookPreviewLoading ? (
                <p className="text-sm text-muted-foreground">Loading BoraPay balance…</p>
              ) : null}
              {bookPreviewErr ? (
                <p className="text-sm text-destructive">{bookPreviewErr}</p>
              ) : null}
              {bookPreview && selectedIds.length === 1 ? (
                <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">
                    BoraPay USD (platform balance):{" "}
                    <span className="tabular-nums">${bookPreview.platform_balance_usd}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      ({bookPreview.platform_balance_minor} cents)
                    </span>
                  </p>
                  {bookPreview.balance_amount_raw ? (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Cybrid balance amount: {bookPreview.balance_amount_raw}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[220px] flex-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Amount (USD cents)
                  </label>
                  <Input
                    value={bookAmount}
                    onChange={(e) => setBookAmount(e.target.value)}
                    placeholder="Prefilled from BoraPay; empty = full balance per user"
                    className="mt-1 font-mono text-sm"
                    inputMode="numeric"
                    disabled={bookPreviewLoading}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      bookPreviewLoading ||
                      !bookPreview ||
                      bookPreview.platform_balance_minor < 1 ||
                      selectedIds.length !== 1
                    }
                    onClick={() =>
                      setBookAmount(
                        bookPreview && bookPreview.platform_balance_minor > 0
                          ? String(bookPreview.platform_balance_minor)
                          : "",
                      )
                    }
                  >
                    Use BoraPay amount
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bookPreviewLoading}
                    onClick={() => setBookAmount("")}
                  >
                    Transfer all
                  </Button>
                  <Button
                    type="button"
                    disabled={batchRunning || selectedIds.length === 0 || bookPreviewLoading}
                    onClick={() => void runBook()}
                  >
                    Run book transfer
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {panelAction === "trade" ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">With users selected</span>, each gets a customer-scoped
                quote and trade. <span className="font-medium text-foreground">With none selected</span>, runs one
                bank/platform trade (platform fiat → bank USDC_SOL trading), using{" "}
                <span className="font-mono text-xs">CYBRID_BANK_GUID</span> and{" "}
                <span className="font-mono text-xs">CYBRID_PLATFORM_BANK_ACCOUNT_GUID</span>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-[200px] flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Deliver amount (USD)</label>
                  <Input
                    value={tradeUsd}
                    onChange={(e) => setTradeUsd(e.target.value)}
                    placeholder="e.g. 100"
                    className="mt-1"
                    inputMode="decimal"
                  />
                </div>
                <Button type="button" disabled={batchRunning} onClick={() => void runTrade()}>
                  Run trade
                </Button>
              </div>
            </div>
          ) : null}

          {panelAction === "withdraw" ? (
            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Deliver amount (USDC_SOL minor units)
                </label>
                <Input
                  value={withdrawMinor}
                  onChange={(e) => setWithdrawMinor(e.target.value)}
                  placeholder="Prefilled from bank trading platform_balance"
                  className="mt-1 font-mono text-sm"
                  inputMode="numeric"
                />
                {withdrawTradingLoading ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Loading default from bank-owned USDC_SOL trading account…
                  </p>
                ) : withdrawTradingErr ? (
                  <p className="mt-1 text-xs text-destructive">{withdrawTradingErr}</p>
                ) : withdrawTradingPreview ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Default{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {withdrawTradingPreview.platform_balance_minor}
                    </span>{" "}
                    from Cybrid{" "}
                    <span className="font-mono">
                      GET /accounts?owner=bank&amp;bank_guid=…
                    </span>{" "}
                    (type trading, asset USDC_SOL). You can change this before running withdraw; each user must still
                    have enough USDC_SOL trading balance.
                  </p>
                ) : null}
              </div>
              <div className="text-sm">
                <p className="text-xs font-medium text-muted-foreground">Destination (Cybrid)</p>
                {withdrawPlatformLoading ? (
                  <p className="mt-1 text-muted-foreground">Loading Platform Wallet…</p>
                ) : withdrawPlatformErr ? (
                  <p className="mt-1 text-destructive">{withdrawPlatformErr}</p>
                ) : withdrawPlatformWallet ? (
                  <div className="mt-1 space-y-0.5 font-mono text-xs break-all text-foreground">
                    <p>
                      <span className="text-muted-foreground">Name:</span> {withdrawPlatformWallet.name} ·{" "}
                      {withdrawPlatformWallet.asset} · {withdrawPlatformWallet.state}
                    </p>
                    <p>
                      <span className="text-muted-foreground">GUID:</span> {withdrawPlatformWallet.guid}
                    </p>
                    {withdrawPlatformWallet.address ? (
                      <p>
                        <span className="text-muted-foreground">Address:</span> {withdrawPlatformWallet.address}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  disabled={
                    batchRunning ||
                    selectedIds.length === 0 ||
                    withdrawPlatformLoading ||
                    !withdrawPlatformWallet?.guid
                  }
                  onClick={() => void runWithdraw()}
                >
                  Run withdraw (quote + execute)
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  External wallet: <span className="font-mono">GET …/external_wallets?bank_guid=</span> (Platform Wallet /
                  USDC_SOL / completed). Transfer participants use <span className="font-mono">CYBRID_BANK_GUID</span>.
                </p>
              </div>
            </div>
          ) : null}

          {batchSummary ? (
            <p className="border-t border-border pt-3 text-sm text-foreground">{batchSummary}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, phone, user id…"
              className="mt-1"
            />
          </div>
          <FilterToggle label="Verified" value={verified} onChange={setVerified} />
          <FilterToggle label="Active" value={active} onChange={setActive} />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cybrid</label>
            <select
              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
              value={cybrid ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCybrid(v === "" ? undefined : (v as "linked" | "not_linked"));
              }}
            >
              <option value="">Any</option>
              <option value="linked">Linked</option>
              <option value="not_linked">Not linked</option>
            </select>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {loading ? "Loading…" : "Apply"}
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-danger/40 bg-danger-muted/30 px-4 py-3 text-sm">{err}</div>
      ) : null}

      <div
        className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card"
        aria-busy={loading}
      >
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/80 text-xs text-muted-foreground">
            <tr>
              {transferHub ? (
                <th className="w-10 px-2 py-3">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPage && !allOnPageSelected;
                    }}
                    onChange={toggleSelectAllPage}
                    aria-label="Select all on page"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Verification</th>
              <th className="px-4 py-3 font-medium">Cybrid</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <UsersDirectoryTableSkeleton transferHub={transferHub} rowCount={Math.min(limit, 12)} />
            ) : null}
            {!loading
              ? rows.map((u) => (
              <tr
                key={u.user_id}
                className="cursor-pointer border-b border-border/80 transition-colors last:border-0 hover:bg-surface-muted/60"
                onClick={() => openUserDetail(u.user_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openUserDetail(u.user_id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {transferHub ? (
                  <td
                    className="px-2 py-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={selected.has(u.user_id)}
                      onChange={(e) => toggleOne(u.user_id, e.target.checked)}
                      aria-label={`Select ${u.full_name || u.user_id}`}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{u.user_id}</p>
                </td>
                <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground" title={u.email ?? ""}>
                  {u.email || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.phone || "—"}</td>
                <td className="px-4 py-3">
                  <UserStatusBadge isVerified={u.is_verified} isActive={u.is_active} />
                </td>
                <td className="px-4 py-3">
                  <CybridLinkStatusBadge linked={u.cybrid_linked} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {u.last_login_at ? u.last_login_at.slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openUserDetail(u.user_id)}
                    >
                      View
                    </Button>
                    <Link
                      href="/transfers"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Transfers
                    </Link>
                  </div>
                </td>
              </tr>
            ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                  No users for these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex min-h-[1rem] items-center">
          {loading ? (
            <Skeleton className="h-3 w-44" shimmer />
          ) : total > 0 ? (
            <>
              Showing {offset + 1}–{Math.min(offset + rows.length, total)} of {total}
            </>
          ) : (
            "—"
          )}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + rows.length >= total || loading}
            onClick={() => setOffset((o) => o + limit)}
          >
            Next
          </Button>
        </div>
      </div>

      {transferHub ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Recent operations</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOps()}>
              {opsLoading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          {opsErr ? <p className="text-sm text-destructive">{opsErr}</p> : null}
          <div className="max-h-[320px] overflow-auto text-xs">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-muted/90 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Time</th>
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {opsLoading && ops.length === 0 ? (
                  <RecentOperationsSkeleton rows={8} />
                ) : null}
                {!opsLoading || ops.length > 0
                  ? ops.map((o) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[10px] text-muted-foreground">
                      {o.created_at?.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="max-w-[100px] truncate px-2 py-2 font-mono text-[10px]" title={o.user_id}>
                      {o.user_id.slice(0, 8)}…
                    </td>
                    <td className="px-2 py-2">{o.operation_type}</td>
                    <td className="px-2 py-2">{o.status}</td>
                    <td className="max-w-[200px] truncate px-2 py-2 text-muted-foreground" title={o.error_message ?? ""}>
                      {o.error_message || "—"}
                    </td>
                  </tr>
                ))
                  : null}
              </tbody>
            </table>
            {ops.length === 0 && !opsLoading ? (
              <p className="py-6 text-center text-muted-foreground">No operations logged yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <UserDetailDrawer
        open={drawerOpen}
        userId={detailUserId}
        onClose={() => setDrawerOpen(false)}
        onFullyClosed={() => setDetailUserId(null)}
      />
    </div>
  );
}

function UsersDirectoryTableSkeleton({
  transferHub,
  rowCount = 10,
}: {
  transferHub: boolean;
  rowCount?: number;
}) {
  const nameW = ["max-w-[200px]", "max-w-[168px]", "max-w-[184px]", "max-w-[156px]", "max-w-[192px]"] as const;
  const emailW = ["max-w-[140px]", "max-w-[120px]", "max-w-[132px]", "max-w-[148px]", "max-w-[128px]"] as const;

  return (
    <>
      {Array.from({ length: rowCount }, (_, i) => (
        <tr key={i} className="border-b border-border/80 last:border-0">
          {transferHub ? (
            <td className="px-2 py-3 align-middle">
              <Skeleton className="size-4 rounded" shimmer={i % 2 === 0} />
            </td>
          ) : null}
          <td className="px-4 py-3">
            <Skeleton className={cn("h-4 w-full", nameW[i % 5])} />
            <Skeleton className="mt-2 h-3 w-28 max-w-[90%]" />
          </td>
          <td className="max-w-[160px] px-4 py-3">
            <Skeleton className={cn("h-4 w-full", emailW[i % 5])} />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-6 w-[4.5rem] rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-6 w-14 rounded-full" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-3 w-28" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-14 shrink-0 rounded-md" />
              <Skeleton className="h-8 w-[5.25rem] shrink-0 rounded-md" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function RecentOperationsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-t border-border/60">
          <td className="px-2 py-2">
            <Skeleton className="h-3 w-28" />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-3 w-14" />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-3 w-24" />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-3 w-12" />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-3 w-full max-w-[200px]" />
          </td>
        </tr>
      ))}
    </>
  );
}

function FilterToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1 flex rounded-lg border border-border p-0.5">
        {(["any", "yes", "no"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              (k === "any" && value === undefined) ||
                (k === "yes" && value === true) ||
                (k === "no" && value === false)
                ? "bg-primary-muted text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => {
              if (k === "any") onChange(undefined);
              else if (k === "yes") onChange(true);
              else onChange(false);
            }}
          >
            {k === "any" ? "Any" : k === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}
