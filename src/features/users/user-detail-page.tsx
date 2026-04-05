"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import {
  AdminApiError,
  adminUserDetail,
  type AdminUserDetailResponse,
} from "@/lib/remittance-admin-api";
import { CybridLinkStatusBadge, UserStatusBadge } from "./user-badges";
import { cn } from "@/lib/utils";

type Tab = "profile" | "cybrid" | "activity";

export function UserDetailPage({ userId }: { userId: string }) {
  const { getAccessToken } = useAuth();
  const token = getAccessToken();
  const [tab, setTab] = React.useState<Tab>("profile");
  const [data, setData] = React.useState<AdminUserDetailResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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
        <Link href="/transfers" className={buttonVariants()}>
          Open transfers
        </Link>
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
