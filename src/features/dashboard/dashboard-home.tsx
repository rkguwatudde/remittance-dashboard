"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleX,
  Clock3,
  Hourglass,
  Landmark,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  Smartphone,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminDashboardOverview,
  type AdminDashboardOverview,
  type AdminDashboardRailHealth,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

function formatVolume(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "UGX",
      maximumFractionDigits: amount >= 1_000_000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function railLabel(status: AdminDashboardRailHealth["status"]): string {
  switch (status) {
    case "healthy":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "unhealthy":
      return "Down";
    default:
      return "No data";
  }
}

function RailRow({
  title,
  icon: Icon,
  rail,
  sub,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rail: AdminDashboardRailHealth & { provider?: string; lastCheckedAt?: string | null };
  sub?: string;
}) {
  const variant =
    rail.status === "healthy"
      ? "success"
      : rail.status === "degraded"
        ? "warning"
        : rail.status === "unhealthy"
          ? "destructive"
          : "secondary";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-muted/40 px-4 py-3">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{rail.detail}</p>
          {sub ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{sub}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={variant} className="capitalize tabular-nums">
          <span
            className={cn(
              "mr-1.5 inline-block size-1.5 rounded-full",
              rail.status === "healthy" && "animate-pulse bg-current",
              rail.status === "degraded" && "bg-current",
              rail.status === "unhealthy" && "bg-current",
              rail.status === "unknown" && "bg-current opacity-60",
            )}
          />
          {railLabel(rail.status)}
        </Badge>
      </div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-16 rounded-full" shimmer={false} />
        </div>
        <Skeleton className="mt-4 h-4 w-[52%]" />
        <Skeleton className="mt-3 h-8 w-[68%]" />
        <Skeleton className="mt-2 h-3 w-[88%] max-w-[14rem]" />
      </CardContent>
    </Card>
  );
}

function RailRowSkeleton() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/80 bg-surface-muted/40 px-4 py-3">
      <div className="flex min-w-0 flex-1 gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full max-w-md" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
    </div>
  );
}

function DashboardOverviewPlaceholder() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Loading dashboard metrics"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="mt-2 h-4 w-[90%] max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-4 w-28" />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="mt-2 h-4 w-full max-w-lg" />
          </CardHeader>
          <CardContent className="space-y-3">
            <RailRowSkeleton />
            <RailRowSkeleton />
            <RailRowSkeleton />
            <Skeleton className="h-3 w-56 pt-1" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardHome() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [overview, setOverview] = React.useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const overviewRef = React.useRef<AdminDashboardOverview | null>(null);

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError("Sign in to load the dashboard.");
      setLoading(false);
      return;
    }
    if (!overviewRef.current) {
      setLoading(true);
    }
    try {
      const data = await adminDashboardOverview(token);
      overviewRef.current = data;
      setOverview(data);
      setError(null);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          const next = getAccessToken();
          if (next) {
            const data = await adminDashboardOverview(next);
            overviewRef.current = data;
            setOverview(data);
            setError(null);
            return;
          }
        }
      }
      setError(err instanceof AdminApiError ? err.message : "Could not load overview.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAccessToken, refreshAccessToken]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const onManualRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const kpis = overview?.kpis;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Operations overview
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 font-mono text-[10px] uppercase transition-colors",
                loading && !overview && "border-primary/30 bg-primary-muted/30",
              )}
            >
              {loading && !overview ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Radio className="size-3" />
              )}
              {loading && !overview ? "Syncing" : "Live"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-[15px]">
            Volume, pipeline health, and rail status across remittance. Refreshes every{" "}
            {POLL_MS / 1000}s while this page is open.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            disabled={loading || refreshing}
            onClick={onManualRefresh}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          <Link
            href="/send"
            className={cn(buttonVariants({ size: "sm" }), "gap-2 no-underline")}
          >
            <Send className="size-4" />
            Send money
          </Link>
          <Link
            href="/send?intent=request"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2 no-underline",
            )}
          >
            <ArrowDownLeft className="size-4" />
            Request money
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-destructive">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}


      {loading && !overview ? <DashboardOverviewPlaceholder /> : null}

      {kpis ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              title="Total volume sent"
              value={formatVolume(kpis.totalVolumeSent, kpis.volumeCurrency)}
              subtitle={`Successful transfers · primary currency ${kpis.volumeCurrency}`}
              icon={ArrowUpRight}
            />
            <KpiCard
              title="Total transactions"
              value={kpis.totalTransactions.toLocaleString()}
              subtitle="All remittance rows"
              icon={Activity}
            />
            <KpiCard
              title="Success rate"
              value={
                kpis.successRatePercent != null
                  ? `${kpis.successRatePercent.toFixed(1)}%`
                  : "—"
              }
              subtitle="Settled / (settled + failed + timeout)"
              icon={Clock3}
              accent="success"
            />
            <KpiCard
              title="Pending"
              value={kpis.pendingTransactions.toLocaleString()}
              subtitle="Queued / in flight at providers"
              icon={Hourglass}
            />
            <KpiCard
              title="Failed"
              value={kpis.failedTransactions.toLocaleString()}
              subtitle="Failed + timeout"
              icon={CircleX}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  <CardTitle>Wallet balance</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Active remittance provider float (live probe).
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.wallet.error ? (
                  <p className="text-sm text-warning">{overview.wallet.error}</p>
                ) : overview.wallet.balance != null ? (
                  <>
                    <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                      {overview.wallet.balance.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Provider{" "}
                      <span className="font-mono text-foreground">
                        {overview.wallet.provider ?? "—"}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No balance available.</p>
                )}
                <Link
                  href="/transactions"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View transactions
                  <ArrowRight className="size-4" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-primary" />
                  <CardTitle>System health</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cybrid inferred from ACH outcomes; MM / bank from provider probes.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <RailRow title="Cybrid (ACH)" icon={Building2} rail={overview.systemHealth.cybrid} />
                <RailRow
                  title="Mobile money"
                  icon={Smartphone}
                  rail={overview.systemHealth.mobileMoney}
                  sub={`Probe target · ${overview.systemHealth.mobileMoney.provider}`}
                />
                <RailRow
                  title="Bank transfer"
                  icon={Landmark}
                  rail={overview.systemHealth.bankTransfer}
                  sub={`Probe target · ${overview.systemHealth.bankTransfer.provider}`}
                />
                {overview.generatedAt ? (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Snapshot{" "}
                    <span className="font-mono">{new Date(overview.generatedAt).toLocaleString()}</span>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
