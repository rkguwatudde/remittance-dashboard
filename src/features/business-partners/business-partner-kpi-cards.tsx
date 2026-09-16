"use client";

import * as React from "react";
import { Banknote, Hash, Receipt } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminBusinessPartnerLedgerStats,
  type AdminBusinessPartnerLedgerStats,
} from "@/lib/remittance-admin-api";

function formatMajor(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const zeroFraction = code === "UGX" || code === "KES" || code === "TZS";
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: zeroFraction ? 0 : 2,
    minimumFractionDigits: 0,
  })} ${code}`;
}

export function BusinessPartnerKpiCards({ refreshKey = 0 }: { refreshKey?: number }) {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [stats, setStats] = React.useState<AdminBusinessPartnerLedgerStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        let token = getAccessToken();
        if (!token) {
          const ok = await refreshAccessToken();
          if (ok) token = getAccessToken();
        }
        if (!token) throw new AdminApiError("Not signed in.", "UNAUTHORIZED", 401);
        const data = await adminBusinessPartnerLedgerStats(token);
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof AdminApiError ? e.message : "Could not load summary.");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, refreshAccessToken, refreshKey]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {error}
      </p>
    );
  }

  if (!stats) return null;

  const amountLabel = formatMajor(stats.amountTransacted.amountMajor, stats.amountTransacted.currency);
  const otherVolumes = stats.receiveByCurrency.filter(
    (r) =>
      r.currency !== stats.amountTransacted.currency ||
      r.amountMajor !== stats.amountTransacted.amountMajor,
  );
  const volumeSubtitle =
    otherVolumes.length > 0
      ? `Successful payouts · also ${otherVolumes.map((r) => formatMajor(r.amountMajor, r.currency)).join(", ")}`
      : "Successful payout volume";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiCard
        title="Total transactions"
        value={stats.totalTransactions.toLocaleString("en-US")}
        subtitle="All business-partner payouts"
        icon={Hash}
      />
      <KpiCard
        title="Amount transacted"
        value={amountLabel}
        subtitle={volumeSubtitle}
        icon={Banknote}
        accent="success"
        valueTitle={amountLabel}
      />
      <KpiCard
        title="Fees"
        value={`$${stats.totalFeesUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        subtitle="Platform fees on successful payouts (USD)"
        icon={Receipt}
      />
    </div>
  );
}
