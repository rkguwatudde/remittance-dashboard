"use client";

import * as React from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminCybridBookTransferCustomerAccounts,
  adminCybridBookTransferExecute,
  adminCybridBookTransferQuote,
  adminUsersList,
  type AdminCybridBookTransferAccount,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";

function usdToCents(value: string): { cents: number; error?: string } {
  const raw = value.trim().replace(/[$,\s]/g, "");
  if (!raw) return { cents: 0, error: "Enter amount." };
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return { cents: 0, error: "Enter a valid positive amount." };
  if (n < 0.01) return { cents: 0, error: "Minimum amount is $0.01." };
  return { cents: Math.round(n * 100) };
}

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function BookTransferPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [search, setSearch] = React.useState("");
  const [users, setUsers] = React.useState<AdminUserDirectoryRow[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [usersError, setUsersError] = React.useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [customerGuid, setCustomerGuid] = React.useState("");
  const [accounts, setAccounts] = React.useState<AdminCybridBookTransferAccount[]>([]);
  const [sourceGuid, setSourceGuid] = React.useState("");
  const [destGuid, setDestGuid] = React.useState("");
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const [amountUsd, setAmountUsd] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{ guid: string; state?: string } | null>(null);

  const loadUsers = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUsersError("Sign in to continue.");
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await adminUsersList(token, { q: search.trim() || undefined, cybrid: "linked", limit: 100, offset: 0 });
      setUsers(data.users);
    } catch (e) {
      setUsers([]);
      setUsersError(e instanceof AdminApiError ? e.message : "Could not load customers.");
    } finally {
      setUsersLoading(false);
    }
  }, [getAccessToken, search]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const loadAccounts = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token || !selectedUserId) return;
    setAccountsLoading(true);
    setAccountsError(null);
    setSubmitError(null);
    setSuccess(null);
    try {
      const data = await adminCybridBookTransferCustomerAccounts(token, selectedUserId);
      setCustomerGuid(data.cybrid_customer_id);
      setAccounts(data.accounts);
      setWarnings(data.warnings || []);
      setSourceGuid(data.default_source_account_guid ?? "");
      setDestGuid(data.default_destination_account_guid ?? "");
    } catch (e) {
      setAccounts([]);
      setCustomerGuid("");
      setSourceGuid("");
      setDestGuid("");
      setWarnings([]);
      setAccountsError(e instanceof AdminApiError ? e.message : "Could not load customer accounts.");
    } finally {
      setAccountsLoading(false);
    }
  }, [getAccessToken, selectedUserId]);

  React.useEffect(() => {
    if (!selectedUserId) {
      setAccounts([]);
      setCustomerGuid("");
      setSourceGuid("");
      setDestGuid("");
      setWarnings([]);
      return;
    }
    void loadAccounts();
  }, [selectedUserId, loadAccounts]);

  const selectedUser = users.find((u) => u.user_id === selectedUserId) ?? null;
  const parsed = usdToCents(amountUsd);

  const runTransfer = async () => {
    setSubmitError(null);
    setSuccess(null);
    if (!selectedUserId) {
      setSubmitError("Select a customer first.");
      return;
    }
    if (parsed.error) {
      setSubmitError(parsed.error);
      return;
    }
    if (!sourceGuid || !destGuid) {
      setSubmitError("Select source and destination accounts.");
      return;
    }

    const exec = async (token: string) => {
      const quote = await adminCybridBookTransferQuote(token, parsed.cents);
      return adminCybridBookTransferExecute(token, {
        quote_guid: quote.quote_guid,
        user_id: selectedUserId,
        source_account_guid: sourceGuid,
        destination_account_guid: destGuid,
        amount: parsed.cents,
      });
    };

    const token = getAccessToken();
    if (!token) {
      setSubmitError("Sign in to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await exec(token);
      const t = data.transfer as Record<string, unknown>;
      setSuccess({
        guid: (t.guid as string) || (t.transfer_guid as string) || "—",
        state: typeof t.state === "string" ? t.state : undefined,
      });
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          const next = getAccessToken();
          if (next) {
            try {
              const data = await exec(next);
              const t = data.transfer as Record<string, unknown>;
              setSuccess({
                guid: (t.guid as string) || (t.transfer_guid as string) || "—",
                state: typeof t.state === "string" ? t.state : undefined,
              });
              return;
            } catch (e2) {
              setSubmitError(e2 instanceof AdminApiError ? e2.message : "Book transfer failed.");
              return;
            }
          }
        }
      }
      setSubmitError(e instanceof AdminApiError ? e.message : "Book transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Cybrid</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Book transfer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick customer, fetch USD fiat accounts, then run quote → execute immediately.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Move funds</CardTitle>
          <p className="text-sm text-muted-foreground">Book transfer settles instantly.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Find customer</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone, user id" className="mt-1" />
            </div>
            <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={usersLoading}>
              {usersLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} 
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Customer</label>
            <select
              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select a customer…</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {(u.full_name || "Unknown")} · {u.email || u.phone || u.user_id.slice(0, 8)}…
                </option>
              ))}
            </select>
            {usersError ? <p className="mt-1 text-xs text-destructive">{usersError}</p> : null}
          </div>

          {selectedUser ? (
            <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-xs">
              <p className="font-mono text-muted-foreground">user_id: <span className="text-foreground">{selectedUser.user_id}</span></p>
              <p className="font-mono text-muted-foreground">customer_guid: <span className="text-foreground">{customerGuid || "—"}</span></p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">From (source account)</label>
              <select
                className="mt-1 flex h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                value={sourceGuid}
                onChange={(e) => setSourceGuid(e.target.value)}
                disabled={accountsLoading || accounts.length === 0}
              >
                <option value="">Select source…</option>
                {accounts.map((a) => (
                  <option key={a.guid} value={a.guid}>{a.name || "Fiat account"} · {a.guid.slice(0, 10)}…</option>
                ))}
              </select>
            </div>
            <div className="hidden justify-center sm:flex"><ArrowRight className="size-5 text-muted-foreground" /></div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">To (destination account)</label>
              <select
                className="mt-1 flex h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                value={destGuid}
                onChange={(e) => setDestGuid(e.target.value)}
                disabled={accountsLoading || accounts.length === 0}
              >
                <option value="">Select destination…</option>
                {accounts.map((a) => (
                  <option key={a.guid} value={a.guid}>{a.name || "Fiat account"} · {a.guid.slice(0, 10)}…</option>
                ))}
              </select>
            </div>
          </div>
          {accountsLoading ? <p className="text-xs text-muted-foreground">Loading customer accounts…</p> : null}
          {accountsError ? <p className="text-xs text-destructive">{accountsError}</p> : null}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Amount (USD)</label>
            <Input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} placeholder="10.00" inputMode="decimal" className="mt-1 font-mono" />
            <p className="mt-1 text-xs text-muted-foreground">Backend receives cents: {parsed.error ? "—" : parsed.cents}</p>
          </div>

          {warnings.length > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning-muted/30 px-3 py-2 text-xs text-warning">
              {warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          ) : null}

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          {success ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
              Transfer completed · <span className="font-mono">{success.guid}</span>
              {success.state ? <span className="ml-2 capitalize text-muted-foreground">{success.state}</span> : null}
              <span className="ml-2 text-muted-foreground">· {fmtUsd(parsed.cents)}</span>
            </div>
          ) : null}

          <Button type="button" className="h-11 w-full font-semibold" onClick={() => void runTransfer()} disabled={submitting || !!parsed.error || !selectedUserId || !sourceGuid || !destGuid}>
            {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Processing…</> : "Transfer funds"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
