"use client";

import * as React from "react";
import { Activity, Database, Layers, RefreshCw, Server } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminQueueOverview,
  type AdminBullmqQueueSnapshot,
  type AdminQueueOverview,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

const COUNT_KEYS = ["waiting", "active", "delayed", "failed", "completed", "paused"] as const;

function isBullmqError(s: AdminBullmqQueueSnapshot): s is { queue: string; error: string } {
  return "error" in s;
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "warning" | "outline" {
  switch (status) {
    case "processing":
      return "default";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "completed":
      return "secondary";
    default:
      return "outline";
  }
}

export function QueuePage() {
  const { getAccessToken } = useAuth();
  const token = getAccessToken();

  const [data, setData] = React.useState<AdminQueueOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setErr("Not signed in.");
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const out = await adminQueueOverview(token);
      setData(out);
    } catch (e) {
      setData(null);
      setErr(e instanceof AdminApiError ? e.message : "Failed to load queue overview.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sendTotals = data?.send_money_jobs?.by_status;
  const inFlight =
    (sendTotals?.pending ?? 0) + (sendTotals?.processing ?? 0) + (sendTotals?.failed ?? 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Queues &amp; jobs
            </h1>
            {data && !loading ? (
              <Badge variant="secondary" className="font-mono text-[10px]">
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-[15px]">
            Live BullMQ depths (Redis) and recent <span className="font-mono">send_money_jobs</span>{" "}
            rows (Postgres) from the remittance API — same data the workers use.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          disabled={loading || !token}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {err ? (
        <div className="rounded-lg border border-danger/40 bg-danger-muted/30 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {loading && !data
          ? [0, 1].map((i) => (
              <Card key={i}>
                <CardHeader className="border-b border-border pb-4">
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))
          : data?.bullmq.map((snap) => (
              <Card key={snap.queue}>
                <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-4">
                  <Layers className="size-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-mono text-sm">{snap.queue}</CardTitle>
                    <p className="text-xs text-muted-foreground">BullMQ / Redis</p>
                  </div>
                  {!isBullmqError(snap) && snap.paused ? (
                    <Badge variant="warning" className="shrink-0 text-[10px]">
                      Paused
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-4">
                  {isBullmqError(snap) ? (
                    <p className="text-sm text-destructive">{snap.error}</p>
                  ) : (
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {COUNT_KEYS.map((key) => (
                        <div
                          key={key}
                          className="rounded-lg border border-border/80 bg-surface-muted/40 px-3 py-2"
                        >
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {key}
                          </dt>
                          <dd className="mt-0.5 font-mono text-lg tabular-nums text-foreground">
                            {snap.counts[key] ?? 0}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-3">
            <Database className="size-4 text-primary" />
            <CardTitle className="text-sm">Send-money jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4 text-sm">
            {loading && !data ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : sendTotals ? (
              <>
                {(["pending", "processing", "completed", "failed"] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {sendTotals[k] ?? 0}
                    </span>
                  </div>
                ))}
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  <Activity className="mr-1 inline size-3" />
                  Non-terminal (pending + processing + failed):{" "}
                  <span className="font-mono font-medium text-foreground">{inFlight}</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-4">
            <Server className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">Recent send-money jobs</CardTitle>
              <p className="text-xs text-muted-foreground">
                Newest by <span className="font-mono">updated_at</span> (API returns up to 40)
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Cybrid transfer</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && !data
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3" colSpan={7}>
                            <Skeleton className="h-9 w-full" />
                          </td>
                        </tr>
                      ))
                    : data?.send_money_jobs.recent.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-surface-muted/40">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                            {row.id.slice(0, 8)}…
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            {row.user_id.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.transfer_type}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={statusBadgeVariant(row.status)}
                              className="text-[10px] capitalize"
                            >
                              {row.status}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                            {row.updated_at.slice(0, 19).replace("T", " ")}
                          </td>
                          <td className="max-w-[140px] truncate px-4 py-3 font-mono text-[10px] text-muted-foreground">
                            {row.transfer_guid ?? "—"}
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-xs text-muted-foreground">
                            {row.error_message ?? "—"}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!loading && data && data.send_money_jobs.recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No send-money jobs in the database yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
