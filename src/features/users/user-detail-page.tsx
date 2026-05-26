"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminPullFundsBankAccounts,
  adminPullFundsExecute,
  adminUserDetail,
  type AdminPullFundsBankAccount,
  type AdminPullFundsExecuteResponse,
  type AdminUserDetailResponse,
} from "@/lib/remittance-admin-api";
import { CybridLinkStatusBadge, UserStatusBadge } from "./user-badges";
import { cn } from "@/lib/utils";

type Tab = "profile" | "cybrid" | "activity";

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function accountDisplayLabel(a: AdminPullFundsBankAccount): string {
  const accountName = a.plaid_account_name?.trim() || "Plaid account";
  const bank = a.bank_name?.trim() || "Bank";
  const mask = a.account_mask?.trim() || a.guid.slice(0, 8);
  return `${accountName} · ${bank} · ${mask}`;
}

export function UserDetailPage({ userId }: { userId: string }) {
  const { getAccessToken, refreshAccessToken, user } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const token = getAccessToken();
  const [tab, setTab] = React.useState<Tab>("profile");
  const [data, setData] = React.useState<AdminUserDetailResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pullOpen, setPullOpen] = React.useState(false);
  const [pullStep, setPullStep] = React.useState<1 | 2 | 3>(1);
  const [accounts, setAccounts] = React.useState<AdminPullFundsBankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [selectedAccountGuid, setSelectedAccountGuid] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pullError, setPullError] = React.useState<string | null>(null);
  const [pullSubmitting, setPullSubmitting] = React.useState(false);
  const [pullSuccess, setPullSuccess] = React.useState<AdminPullFundsExecuteResponse | null>(null);
  const customerGuidRef = React.useRef<string>("");
  const idempotencyKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await adminUserDetail(token, userId);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof AdminApiError ? e.message : "Failed to load user.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading user…</div>
    );
  }
  if (err || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-danger/40 bg-danger-muted/30 px-4 py-3 text-sm">{err}</div>
        <Link href="/users" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}>
          Back to users
        </Link>
      </div>
    );
  }

  const p = data.profile;
  const linked = Boolean(data.cybrid?.cybrid_customer_id);
  const role = normalizeRole(user?.role);
  const canPullFunds = role === "SUPER_ADMIN" || role === "FINANCE_ADMIN";
  const selectedAccount = accounts.find((a) => a.guid === selectedAccountGuid) ?? null;
  const amountNum = Number.parseFloat(amount.trim());
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const openPullFunds = async () => {
    const currentToken = getAccessToken();
    if (!currentToken) return;
    setPullOpen(true);
    setPullStep(1);
    setPullError(null);
    setPullSuccess(null);
    setSelectedAccountGuid("");
    setAmount("");
    setNote("");
    idempotencyKeyRef.current = "";
    setAccountsLoading(true);
    try {
      let resp;
      try {
        resp = await adminPullFundsBankAccounts(currentToken, userId);
      } catch (e) {
        if (!(e instanceof AdminApiError) || e.status !== 401) throw e;
        const ok = await refreshAccessToken();
        if (!ok) throw new Error("Session expired. Please sign in again.");
        const refreshed = getAccessToken();
        if (!refreshed) throw new Error("Session expired. Please sign in again.");
        resp = await adminPullFundsBankAccounts(refreshed, userId);
      }
      customerGuidRef.current = resp.customer_guid;
      setAccounts(resp.accounts);
      const firstReady = resp.accounts.find((a) => a.is_ready);
      setSelectedAccountGuid(firstReady?.guid ?? "");
    } catch (e) {
      setPullError(e instanceof AdminApiError ? e.message : "Failed to load bank accounts.");
      setAccounts([]);
      customerGuidRef.current = "";
    } finally {
      setAccountsLoading(false);
    }
  };

  const confirmPullFunds = async () => {
    if (!selectedAccount || !amountValid || !customerGuidRef.current) return;
    const currentToken = getAccessToken();
    if (!currentToken) {
      setPullError("Session expired. Please sign in again.");
      return;
    }
    setPullSubmitting(true);
    setPullError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pull-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    try {
      const payload = {
        userId,
        customerGuid: customerGuidRef.current,
        externalBankAccountGuid: selectedAccount.guid,
        amount: Number(amountNum.toFixed(2)),
        note: note.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      };
      let resp: AdminPullFundsExecuteResponse;
      try {
        resp = await adminPullFundsExecute(currentToken, payload);
      } catch (e) {
        if (!(e instanceof AdminApiError) || e.status !== 401) throw e;
        const ok = await refreshAccessToken();
        if (!ok) throw new Error("Session expired. Please sign in again.");
        const refreshed = getAccessToken();
        if (!refreshed) throw new Error("Session expired. Please sign in again.");
        resp = await adminPullFundsExecute(refreshed, payload);
      }
      setPullSuccess(resp);
      setPullStep(3);
    } catch (e) {
      setPullError(e instanceof AdminApiError ? e.message : "Pull funds failed.");
    } finally {
      setPullSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/users"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2 inline-flex")}
          >
            ← Users
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{p.full_name || "User"}</h1>
          <p className="font-mono text-xs text-muted-foreground">{p.user_id}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <UserStatusBadge isVerified={p.is_verified} isActive={p.is_active} />
            <CybridLinkStatusBadge linked={linked} />
            {!data.eligibility.can_transfer ? (
              <span className="rounded-md border border-warning/50 bg-warning-muted/30 px-2 py-0.5 text-[10px] font-semibold text-warning">
                Transfers blocked
              </span>
            ) : (
              <span className="rounded-md border border-success/40 bg-success-muted px-2 py-0.5 text-[10px] font-semibold text-success">
                Transfer eligible
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPullFunds ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void openPullFunds()}
              disabled={!linked}
            >
              Pull Funds
            </Button>
          ) : null}
          {isSuperAdmin ? (
            <Link href="/transfer?tab=cybrid" className={buttonVariants()}>
              Open Transfer
            </Link>
          ) : null}
        </div>
      </div>

      {!data.eligibility.can_transfer && data.eligibility.blockers.length > 0 ? (
        <div className="rounded-lg border border-warning/50 bg-warning-muted/20 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Blockers</p>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            {data.eligibility.blockers.map((b) => (
              <li key={b.code}>
                <span className="font-mono">{b.code}</span> — {b.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["profile", "Profile"],
            ["cybrid", "Cybrid"],
            ["activity", "Activity"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <dl className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <Row k="Email" v={p.email} />
          <Row k="Phone" v={p.phone} />
          <Row k="Verification status" v={p.verification_status} />
          <Row k="Onboarding completed" v={String(p.onboarding_completed)} />
          <Row k="Onboarding step" v={p.onboarding_step != null ? String(p.onboarding_step) : "—"} />
          <Row k="Cybrid integration flag" v={String(p.cybrid_integration_completed)} />
          <Row k="Last login" v={p.last_login_at || p.last_login || "—"} />
          <Row k="Created" v={p.created_at || "—"} />
        </dl>
      ) : null}

      {tab === "cybrid" ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          {data.cybrid ? (
            <dl className="grid gap-3">
              <Row k="cybrid_customer_id" v={data.cybrid.cybrid_customer_id} mono />
              <Row k="verification_status" v={data.cybrid.verification_status} />
              <Row
                k="external_bank_accounts_count"
                v={String(data.cybrid.external_bank_accounts_count ?? "—")}
              />
              <Row k="kyc_state" v={data.cybrid.kyc_state} />
            </dl>
          ) : (
            <p className="text-muted-foreground">No Cybrid mapping for this user.</p>
          )}
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          <p>
            Open remittance transactions and search by this user&apos;s email in the table filter, or
            use your BI tools with <span className="font-mono text-foreground">user_id</span>.
          </p>
          <Link
            href="/transactions"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
          >
            Transactions
          </Link>
        </div>
      ) : null}

      {pullOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Pull Funds from User Bank Account</h2>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => setPullOpen(false)}
                disabled={pullSubmitting}
              >
                Close
              </button>
            </div>

            {pullError ? (
              <div className="mb-3 rounded-lg border border-danger/40 bg-danger-muted/30 px-3 py-2 text-sm">
                {pullError}
              </div>
            ) : null}

            {pullSuccess ? (
              <div className="mb-3 rounded-lg border border-success/40 bg-success-muted px-3 py-2 text-sm">
                Pull funds submitted. Transfer:{" "}
                <span className="font-mono">{pullSuccess.cybrid_transfer_guid || "—"}</span>
              </div>
            ) : null}

            <div className="mb-4 text-xs text-muted-foreground">Step {pullStep} of 3</div>

            {pullStep === 1 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Select user linked bank account.</p>
                {accountsLoading ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : null}
                {!accountsLoading ? (
                  <select
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    value={selectedAccountGuid}
                    onChange={(e) => setSelectedAccountGuid(e.target.value)}
                  >
                    <option value="">Select an account…</option>
                    {accounts.map((a) => (
                      <option key={a.guid} value={a.guid} disabled={!a.is_ready}>
                        {accountDisplayLabel(a)} · {a.state || "unknown"}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setPullStep(2)}
                    disabled={!selectedAccountGuid || accountsLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}

            {pullStep === 2 ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Amount (USD)</label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Note (optional, recommended)</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Retry after failed ACH transfer"
                  />
                </div>
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setPullStep(1)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setPullStep(3)} disabled={!amountValid}>
                    Review
                  </Button>
                </div>
              </div>
            ) : null}

            {pullStep === 3 ? (
              <div className="space-y-3">
                <p className="rounded border border-warning/50 bg-warning-muted/30 px-3 py-2 text-sm">
                  This action will initiate a debit from the user&apos;s bank account. Please confirm.
                </p>
                <div className="rounded border border-border px-3 py-2 text-sm">
                  <p>Account: {selectedAccount ? accountDisplayLabel(selectedAccount) : "—"}</p>
                  <p>Amount: {amountValid ? amountNum.toFixed(2) : "—"} USD</p>
                  <p>Note: {note.trim() || "—"}</p>
                </div>
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPullStep(2)}
                    disabled={pullSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void confirmPullFunds()}
                    disabled={pullSubmitting || !selectedAccount || !amountValid || !!pullSuccess}
                  >
                    {pullSubmitting ? "Processing..." : "Confirm & Pull Funds"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-muted-foreground">{k}</dt>
      <dd className={cn("min-w-0 break-all text-foreground", mono && "font-mono text-xs")}>
        {v ?? "—"}
      </dd>
    </div>
  );
}
