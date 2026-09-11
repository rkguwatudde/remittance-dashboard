"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileJson2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import {
  AdminApiError,
  adminBroadcast,
  adminBanksList,
  adminCreateServiceProvider,
  adminDeleteServiceProvider,
  adminPatchServiceProvider,
  adminPlatformAuditAnomalies,
  adminPlatformAuditLogs,
  adminProviderLogs,
  adminRemittanceAuditLogs,
  adminSystemOverview,
  type AdminBroadcastTarget,
  type AdminBankListItem,
  type AdminPlatformAuditLogRow,
  type AdminRemittanceAuditLogRow,
  type ProviderMetricLogRow,
  type SystemControlCenterOverview,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { AuditLogDrawer } from "./audit-log-drawer";
import { BusinessRatesCard } from "./business-rates-card";
import { ExchangeRatesCard } from "./exchange-rates-card";
import { ProviderLogsDrawer } from "./provider-logs-drawer";
import { RemittanceAuditDrawer } from "./remittance-audit-drawer";

const POLL_MS = 30000;
const PAGE = 25;
const CHART_GRID = "oklch(0.55 0.02 154 / 0.35)";

function statusBadge(
  s: string,
): "success" | "warning" | "destructive" | "secondary" {
  const u = s.toLowerCase();
  if (u === "healthy" || u === "operational") return "success";
  if (u === "degraded" || u === "partial" || u === "unknown" || u === "low_balance") return "warning";
  if (u === "down" || u === "unhealthy" || u === "outage") return "destructive";
  return "secondary";
}

export function SystemAdminPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const isSuper = useIsSuperAdmin();

  const [overview, setOverview] = React.useState<SystemControlCenterOverview | null>(null);
  const [ovLoading, setOvLoading] = React.useState(true);
  const [ovError, setOvError] = React.useState<string | null>(null);

  const [banks, setBanks] = React.useState<AdminBankListItem[]>([]);
  const [banksLoading, setBanksLoading] = React.useState(false);

  const [logsOpen, setLogsOpen] = React.useState(false);
  const [logsName, setLogsName] = React.useState<string | null>(null);
  const [logsRows, setLogsRows] = React.useState<ProviderMetricLogRow[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  const [anomalies, setAnomalies] = React.useState<{
    highTrafficIps: { ip_address: string; count: number }[];
    repeatedFailures: { action: string; count: number }[];
  } | null>(null);

  const [auditTab, setAuditTab] = React.useState<"platform" | "remittance">("platform");
  const [platRows, setPlatRows] = React.useState<AdminPlatformAuditLogRow[]>([]);
  const [platTotal, setPlatTotal] = React.useState(0);
  const [platOff, setPlatOff] = React.useState(0);
  const [platLoading, setPlatLoading] = React.useState(true);
  const [platQIn, setPlatQIn] = React.useState("");
  const [platQ, setPlatQ] = React.useState("");
  const [platFiltersOpen, setPlatFiltersOpen] = React.useState(false);
  const [platAction, setPlatAction] = React.useState("");
  const [platEntity, setPlatEntity] = React.useState("");
  const [platActor, setPlatActor] = React.useState("");
  const [platUserId, setPlatUserId] = React.useState("");
  const [platDevice, setPlatDevice] = React.useState("");
  const [platFrom, setPlatFrom] = React.useState("");
  const [platTo, setPlatTo] = React.useState("");

  const [remRows, setRemRows] = React.useState<AdminRemittanceAuditLogRow[]>([]);
  const [remTotal, setRemTotal] = React.useState(0);
  const [remOff, setRemOff] = React.useState(0);
  const [remLoading, setRemLoading] = React.useState(true);
  const [remQIn, setRemQIn] = React.useState("");
  const [remQ, setRemQ] = React.useState("");
  const [remAdminId, setRemAdminId] = React.useState("");
  const [remFrom, setRemFrom] = React.useState("");
  const [remTo, setRemTo] = React.useState("");

  const [platDrawer, setPlatDrawer] = React.useState<AdminPlatformAuditLogRow | null>(null);
  const [platDrawerOpen, setPlatDrawerOpen] = React.useState(false);
  const [remDrawer, setRemDrawer] = React.useState<AdminRemittanceAuditLogRow | null>(null);
  const [remDrawerOpen, setRemDrawerOpen] = React.useState(false);

  const [mmFilterCountry, setMmFilterCountry] = React.useState("");
  const [mmFilterActive, setMmFilterActive] = React.useState<"all" | "active" | "inactive">("all");
  const [bankQ, setBankQ] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [formId, setFormId] = React.useState<string | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState("mobile_money");
  const [formCountry, setFormCountry] = React.useState("");
  const [formNetwork, setFormNetwork] = React.useState("");
  const [formActive, setFormActive] = React.useState(false);
  const [formBusy, setFormBusy] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = React.useState("");
  const [broadcastMessage, setBroadcastMessage] = React.useState("");
  const [broadcastTarget, setBroadcastTarget] = React.useState<AdminBroadcastTarget>("all_users");
  const [broadcastTopic, setBroadcastTopic] = React.useState("all_users");
  const [broadcastUserIdsRaw, setBroadcastUserIdsRaw] = React.useState("");
  const [broadcastBusy, setBroadcastBusy] = React.useState(false);
  const [broadcastResult, setBroadcastResult] = React.useState<string | null>(null);
  const [broadcastErr, setBroadcastErr] = React.useState<string | null>(null);

  const withToken = React.useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
      let t = getAccessToken();
      if (!t) throw new AdminApiError("Unauthorized", "HTTP_401", 401);
      try {
        return await fn(t);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          t = ok ? getAccessToken() : null;
          if (t) return await fn(t);
        }
        throw e;
      }
    },
    [getAccessToken, refreshAccessToken],
  );

  const overviewInFlight = React.useRef(false);
  const loadOverview = React.useCallback(async () => {
    if (overviewInFlight.current) return;
    overviewInFlight.current = true;
    setOvError(null);
    try {
      const data = await withToken((t) => adminSystemOverview(t));
      setOverview(data);
    } catch (e) {
      setOvError(e instanceof AdminApiError ? e.message : "Failed to load system overview.");
    } finally {
      overviewInFlight.current = false;
      setOvLoading(false);
    }
  }, [withToken]);

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  React.useEffect(() => {
    const id = window.setInterval(() => void loadOverview(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadOverview]);

  React.useEffect(() => {
    const run = async () => {
      try {
        const a = await withToken((t) => adminPlatformAuditAnomalies(t));
        setAnomalies(a);
      } catch {
        setAnomalies(null);
      }
    };
    void run();
    const id = window.setInterval(run, 60_000);
    return () => window.clearInterval(id);
  }, [withToken]);

  React.useEffect(() => {
    void (async () => {
      setBanksLoading(true);
      try {
        const list = await withToken((t) => adminBanksList(t));
        setBanks(list);
      } catch {
        setBanks([]);
      } finally {
        setBanksLoading(false);
      }
    })();
  }, [withToken]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setPlatQ(platQIn.trim()), 350);
    return () => window.clearTimeout(t);
  }, [platQIn]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setRemQ(remQIn.trim()), 350);
    return () => window.clearTimeout(t);
  }, [remQIn]);

  const loadPlatformAudit = React.useCallback(async () => {
    setPlatLoading(true);
    try {
      const res = await withToken((t) =>
        adminPlatformAuditLogs(t, {
          limit: PAGE,
          offset: platOff,
          action: platAction.trim() || undefined,
          entity_type: platEntity.trim() || undefined,
          actor_type: platActor.trim() || undefined,
          user_id: platUserId.trim() || undefined,
          device: platDevice.trim() || undefined,
          date_from: platFrom.trim() || undefined,
          date_to: platTo.trim() || undefined,
          q: platQ || undefined,
        }),
      );
      setPlatRows(res.logs);
      setPlatTotal(res.pagination.total);
    } catch {
      setPlatRows([]);
      setPlatTotal(0);
    } finally {
      setPlatLoading(false);
    }
  }, [withToken, platOff, platAction, platEntity, platActor, platUserId, platDevice, platFrom, platTo, platQ]);

  React.useEffect(() => {
    void loadPlatformAudit();
  }, [loadPlatformAudit]);

  const loadRemAudit = React.useCallback(async () => {
    setRemLoading(true);
    try {
      const res = await withToken((t) =>
        adminRemittanceAuditLogs(t, {
          limit: PAGE,
          offset: remOff,
          admin_id: remAdminId.trim() || undefined,
          date_from: remFrom.trim() || undefined,
          date_to: remTo.trim() || undefined,
          q: remQ || undefined,
        }),
      );
      setRemRows(res.logs);
      setRemTotal(res.pagination.total);
    } catch {
      setRemRows([]);
      setRemTotal(0);
    } finally {
      setRemLoading(false);
    }
  }, [withToken, remOff, remAdminId, remFrom, remTo, remQ]);

  React.useEffect(() => {
    void loadRemAudit();
  }, [loadRemAudit]);

  const openLogs = (name: string) => {
    setLogsName(name);
    setLogsOpen(true);
    setLogsLoading(true);
    setLogsRows([]);
    void (async () => {
      try {
        const rows = await withToken((t) => adminProviderLogs(t, name, 80));
        setLogsRows(rows);
      } catch {
        setLogsRows([]);
      } finally {
        setLogsLoading(false);
      }
    })();
  };

  const startCreateMm = () => {
    if (!isSuper) return;
    setFormMode("create");
    setFormId(null);
    setFormName("");
    setFormType("mobile_money");
    setFormCountry("");
    setFormNetwork("");
    setFormActive(false);
    setFormErr(null);
    setFormOpen(true);
  };

  const startEditMm = (row: SystemControlCenterOverview["serviceProviders"][0]) => {
    setFormMode("edit");
    setFormId(row.id);
    setFormName(row.providerName);
    setFormType(row.providerType);
    setFormCountry((row.config?.country as string) ?? row.country ?? "");
    setFormNetwork((row.config?.network as string) ?? row.network ?? "");
    setFormActive(row.isActive);
    setFormErr(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (formMode === "create" && !isSuper) return;
    if (!formName.trim()) {
      setFormErr("Provider name required.");
      return;
    }
    setFormBusy(true);
    setFormErr(null);
    try {
      const config: Record<string, unknown> = {};
      if (formCountry.trim()) config.country = formCountry.trim();
      if (formNetwork.trim()) config.network = formNetwork.trim();
      if (formMode === "create") {
        await withToken((t) =>
          adminCreateServiceProvider(t, {
            provider_name: formName.trim().toLowerCase(),
            provider_type: formType,
            is_active: formActive,
            config,
          }),
        );
      } else if (formId) {
        await withToken((t) =>
          adminPatchServiceProvider(t, formId, {
            provider_name: formName.trim().toLowerCase(),
            provider_type: formType,
            is_active: formActive,
            config,
          }),
        );
      }
      setFormOpen(false);
      void loadOverview();
    } catch (e) {
      setFormErr(e instanceof AdminApiError ? e.message : "Save failed.");
    } finally {
      setFormBusy(false);
    }
  };

  const deleteProvider = async (id: string) => {
    if (!isSuper || !confirm("Delete this service provider row? Super admin only.")) return;
    try {
      await withToken((t) => adminDeleteServiceProvider(t, id));
      void loadOverview();
    } catch {
      /* toast omitted */
    }
  };

  const submitBroadcast = async () => {
    const title = broadcastTitle.trim();
    const message = broadcastMessage.trim();
    if (!title || !message) {
      setBroadcastErr("Title and message are required.");
      return;
    }

    const payload: {
      title: string;
      message: string;
      target: AdminBroadcastTarget;
      topic?: string;
      userIds?: string[];
    } = {
      title,
      message,
      target: broadcastTarget,
    };

    if (broadcastTarget === "topic") {
      const topic = broadcastTopic.trim();
      if (!topic) {
        setBroadcastErr("Topic is required when target is topic.");
        return;
      }
      payload.topic = topic;
    }

    if (broadcastTarget === "userIds") {
      const userIds = broadcastUserIdsRaw
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter(Boolean);
      if (!userIds.length) {
        setBroadcastErr("Add at least one user ID when target is userIds.");
        return;
      }
      payload.userIds = userIds;
    }

    setBroadcastBusy(true);
    setBroadcastErr(null);
    setBroadcastResult(null);
    try {
      const res = await withToken((t) => adminBroadcast(t, payload));
      setBroadcastResult(
        `Queued successfully. Target count: ${res.targetCount}.`,
      );
    } catch (e) {
      setBroadcastErr(
        e instanceof AdminApiError ? e.message : "Failed to queue broadcast.",
      );
    } finally {
      setBroadcastBusy(false);
    }
  };

  const chartData =
    overview?.apiMetrics.hourly.map((h) => ({
      t: h.label,
      req: h.totalRequests,
      lat: h.avgLatencyMs,
    })) ?? [];

  const mmRows = (overview?.serviceProviders ?? []).filter((r) => {
    if (r.providerType !== "mobile_money" && r.providerType !== "all") return false;
    if (mmFilterCountry.trim()) {
      const c = (r.country ?? (r.config?.country as string) ?? "").toLowerCase();
      if (!c.includes(mmFilterCountry.trim().toLowerCase())) return false;
    }
    if (mmFilterActive === "active" && !r.isActive) return false;
    if (mmFilterActive === "inactive" && r.isActive) return false;
    return true;
  });

  const healthByName = React.useMemo(() => {
    const m = new Map<string, SystemControlCenterOverview["providerHealth"][0]>();
    for (const h of overview?.providerHealth ?? []) {
      m.set(h.provider.toLowerCase(), h);
    }
    return m;
  }, [overview?.providerHealth]);

  const filteredBanks = banks.filter((b) => {
    if (!bankQ.trim()) return true;
    const q = bankQ.trim().toLowerCase();
    return b.bankName.toLowerCase().includes(q) || b.bankCode.toLowerCase().includes(q);
  });

  const showAnomalyBanner =
    anomalies &&
    (anomalies.highTrafficIps.length > 0 || anomalies.repeatedFailures.length > 0);

  return (
    <div className="mx-auto max-w-[1920px] space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            System &amp; admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Provider health, routing configuration, banks, and audit trails. Updates every few seconds.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={ovLoading}
          onClick={() => void loadOverview()}
        >
          <RefreshCw className={cn("size-4", ovLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {ovError ? (
        <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-danger">{ovError}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void loadOverview()}>
            Retry
          </Button>
        </div>
      ) : null}

      {showAnomalyBanner ? (
        <div className="rounded-xl border border-warning/50 bg-warning-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" />
            Unusual activity signals (1h window)
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground">
            {anomalies!.highTrafficIps.length ? (
              <span className="font-mono">
                High-volume IPs:{" "}
                {anomalies!.highTrafficIps.map((x) => `${x.ip_address} (${x.count})`).join("; ")}
              </span>
            ) : null}
            {anomalies!.repeatedFailures.length ? (
              <span>
                Failure-like actions:{" "}
                {anomalies!.repeatedFailures.map((x) => `${x.action}×${x.count}`).join(", ")}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isSuper ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin push broadcast (test)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Title</label>
                <Input
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Maintenance update"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Target</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value as AdminBroadcastTarget)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
                >
                  <option value="all_users">all_users</option>
                  <option value="topic">topic</option>
                  <option value="userIds">userIds</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Testing push delivery from admin dashboard."
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {broadcastTarget === "topic" ? (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Topic</label>
                <Input
                  value={broadcastTopic}
                  onChange={(e) => setBroadcastTopic(e.target.value)}
                  placeholder="all_users"
                  className="mt-1 font-mono text-xs"
                />
              </div>
            ) : null}

            {broadcastTarget === "userIds" ? (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  User IDs (comma or newline separated)
                </label>
                <textarea
                  value={broadcastUserIdsRaw}
                  onChange={(e) => setBroadcastUserIdsRaw(e.target.value)}
                  placeholder="uuid-1, uuid-2"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : null}

            {broadcastErr ? <p className="text-sm text-danger">{broadcastErr}</p> : null}
            {broadcastResult ? <p className="text-sm text-success">{broadcastResult}</p> : null}

            <div className="flex justify-end">
              <Button type="button" disabled={broadcastBusy} onClick={() => void submitBroadcast()}>
                {broadcastBusy ? <Loader2 className="size-4 animate-spin" /> : "Send broadcast"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Banner + API metrics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {overview ? (
              <Badge variant={statusBadge(overview.banner.overallStatus)} className="mb-2 text-[11px]">
                {overview.banner.message}
              </Badge>
            ) : (
              <Skeleton className="h-6 w-48" />
            )}
            <p className="text-[11px] text-muted-foreground">
              Generated{" "}
              {overview ? format(new Date(overview.generatedAt), "HH:mm:ss") : "—"} UTC
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-primary" />
              API traffic &amp; latency (24h UTC buckets)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-36">
            {overview && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} hide />
                  <Tooltip />
                  <Area
                    yAxisId="l"
                    type="monotone"
                    dataKey="req"
                    name="Requests"
                    stroke="var(--color-primary, #6366f1)"
                    fill="var(--color-primary-muted, rgba(99,102,241,0.12))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No provider_metrics in range
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {overview ? (
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ["Cybrid", overview.rails.cybrid],
              ["Mobile money", overview.rails.mobileMoney],
              ["Bank", overview.rails.bank],
            ] as const
          ).map(([title, rail]) => (
            <Card key={title} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Server className="size-4 text-muted-foreground" />
                    {title}
                  </span>
                  <Badge variant={statusBadge(rail.status)} className="text-[10px] capitalize">
                    {rail.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="text-muted-foreground line-clamp-2">{rail.detail ?? "—"}</p>
                {rail.provider ? (
                  <p className="font-mono text-[11px] text-foreground">Provider: {rail.provider}</p>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
                  <span>
                    RT: {rail.responseTimeMs != null ? `${Math.round(rail.responseTimeMs)} ms` : "—"}
                  </span>
                  <span>
                    Err: {rail.errorRate != null ? `${rail.errorRate.toFixed(2)}%` : "—"}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Checked:{" "}
                  {rail.lastCheckedAt
                    ? format(new Date(rail.lastCheckedAt), "MMM d HH:mm")
                    : "—"}
                </p>
                {rail.lastError ? (
                  <p className="text-[10px] text-danger line-clamp-2">{rail.lastError}</p>
                ) : null}
                {rail.provider != null && rail.provider !== "" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-[10px]"
                    onClick={() => openLogs(rail.provider!.toLowerCase())}
                  >
                    <FileJson2 className="size-3" />
                    View logs
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {overview && (overview.apiMetrics.last1h.totalRequests > 0 || overview.apiMetrics.last24h.totalRequests > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1h requests", overview.apiMetrics.last1h.totalRequests],
            ["1h success", `${overview.apiMetrics.last1h.successRate}%`],
            ["24h requests", overview.apiMetrics.last24h.totalRequests],
            ["24h err rate", `${overview.apiMetrics.last24h.errorRatePercent}%`],
          ].map(([label, val]) => (
            <Card key={label as string}>
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">{val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {isSuper ? (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Mobile money providers (service_providers)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Country filter"
              value={mmFilterCountry}
              onChange={(e) => setMmFilterCountry(e.target.value)}
              className="h-9 w-36 font-mono text-xs"
            />
            <select
              value={mmFilterActive}
              onChange={(e) => setMmFilterActive(e.target.value as typeof mmFilterActive)}
              className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
            {isSuper ? (
              <Button type="button" size="sm" className="gap-1" onClick={startCreateMm}>
                <Plus className="size-4" />
                Add
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Network</th>
                <th className="px-3 py-2">Routing</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Last check</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mmRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No rows (add a provider or widen filters).
                  </td>
                </tr>
              ) : (
                mmRows.map((r) => {
                  const h = healthByName.get(r.providerName.toLowerCase());
                  return (
                    <tr key={r.id} className="border-b border-border/80 hover:bg-surface-muted/40">
                      <td className="px-3 py-2 font-mono text-xs">{r.providerName}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.country ?? (r.config?.country as string) ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.network ?? (r.config?.network as string) ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.isActive ? "success" : "secondary"} className="text-[10px]">
                          {r.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {h ? (
                          <Badge variant={statusBadge(h.uiStatus)} className="text-[10px]">
                            {h.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {h?.lastCheckedAt
                          ? format(new Date(h.lastCheckedAt), "MMM d HH:mm")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => startEditMm(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => openLogs(r.providerName.toLowerCase())}
                          >
                            Logs
                          </Button>
                          {isSuper ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-danger"
                              onClick={() => void deleteProvider(r.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      ) : null}

      {/* Banks */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="text-base">Supported banks</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name / code"
              value={bankQ}
              onChange={(e) => setBankQ(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[360px] overflow-y-auto p-0">
          {banksLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading banks…</p>
          ) : filteredBanks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No banks match.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-surface-muted/90 backdrop-blur">
                <tr className="text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Operate time</th>
                </tr>
              </thead>
              <tbody>
                {filteredBanks.map((b) => (
                  <tr key={b.bankCode} className="border-b border-border/80">
                    <td className="px-3 py-2">{b.bankName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.bankCode}</td>
                    <td className="px-3 py-2">
                      <Badge variant="success" className="text-[10px]">
                        Online
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {b.operateTime ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ExchangeRatesCard withToken={withToken} isSuper={isSuper} />
      <BusinessRatesCard withToken={withToken} isSuper={isSuper} />

      {/* Audits */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <CardTitle className="text-base">Audit trails</CardTitle>
          <div className="flex rounded-lg border border-border bg-surface-muted/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAuditTab("platform")}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium",
                auditTab === "platform" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Platform (audit_logs)
            </button>
            <button
              type="button"
              onClick={() => setAuditTab("remittance")}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium",
                auditTab === "remittance" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Remittance admins
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {auditTab === "platform" ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={platQIn}
                    onChange={(e) => setPlatQIn(e.target.value)}
                    placeholder="Entity id, actor id, metadata…"
                    className="h-10 pl-9 font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => setPlatFiltersOpen((v) => !v)}
                >
                  <SlidersHorizontal className="size-4" />
                  Filters
                </Button>
              </div>
              {platFiltersOpen ? (
                <div className="grid gap-2 border border-border bg-surface-muted/30 p-3 md:grid-cols-3 lg:grid-cols-4">
                  <Input
                    placeholder="action"
                    value={platAction}
                    onChange={(e) => {
                      setPlatAction(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    placeholder="entity_type"
                    value={platEntity}
                    onChange={(e) => {
                      setPlatEntity(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    placeholder="actor_type"
                    value={platActor}
                    onChange={(e) => {
                      setPlatActor(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    placeholder="user_id"
                    value={platUserId}
                    onChange={(e) => {
                      setPlatUserId(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    placeholder="device"
                    value={platDevice}
                    onChange={(e) => {
                      setPlatDevice(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9 font-mono text-xs"
                  />
                  <Input
                    type="date"
                    value={platFrom}
                    onChange={(e) => {
                      setPlatFrom(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9"
                  />
                  <Input
                    type="date"
                    value={platTo}
                    onChange={(e) => {
                      setPlatTo(e.target.value);
                      setPlatOff(0);
                    }}
                    className="h-9"
                  />
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                  <thead className="bg-surface-muted/60 text-[10px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Action</th>
                      <th className="px-2 py-2">Entity</th>
                      <th className="px-2 py-2">Actor</th>
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Device</th>
                      <th className="px-2 py-2">IP</th>
                      <th className="px-2 py-2">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platLoading ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                          <Loader2 className="mx-auto size-5 animate-spin" />
                        </td>
                      </tr>
                    ) : platRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                          No audit rows.
                        </td>
                      </tr>
                    ) : (
                      platRows.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-border/80 hover:bg-surface-muted/50"
                          onClick={() => {
                            setPlatDrawer(r);
                            setPlatDrawerOpen(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-2 py-2 font-mono text-[10px] text-muted-foreground">
                            {format(new Date(r.created_at), "MM-dd HH:mm")}
                          </td>
                          <td className="max-w-[120px] truncate px-2 py-2 font-mono">{r.action}</td>
                          <td className="max-w-[140px] truncate px-2 py-2 font-mono" title={`${r.entity_type}:${r.entity_id}`}>
                            {r.entity_type}
                          </td>
                          <td className="max-w-[100px] truncate px-2 py-2 font-mono text-[10px]">
                            {r.actor_type}
                          </td>
                          <td className="max-w-[90px] truncate px-2 py-2 font-mono text-[10px]">
                            {r.user_id ?? "—"}
                          </td>
                          <td className="px-2 py-2 font-mono text-[10px]">{r.device ?? "—"}</td>
                          <td className="max-w-[100px] truncate px-2 py-2 font-mono text-[10px]">
                            {r.ip_address ?? "—"}
                          </td>
                          <td className="max-w-[160px] truncate px-2 py-2 text-muted-foreground" title={r.metadata_preview ?? ""}>
                            {r.metadata_preview ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {platTotal} events · page {Math.floor(platOff / PAGE) + 1} /{" "}
                  {Math.max(1, Math.ceil(platTotal / PAGE))}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={platOff <= 0 || platLoading}
                    onClick={() => setPlatOff((o) => Math.max(0, o - PAGE))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={platOff + PAGE >= platTotal || platLoading}
                    onClick={() => setPlatOff((o) => o + PAGE)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={remQIn}
                    onChange={(e) => setRemQIn(e.target.value)}
                    placeholder="Search metadata / action"
                    className="h-10 pl-9 font-mono text-sm"
                  />
                </div>
                <Input
                  placeholder="admin_id"
                  value={remAdminId}
                  onChange={(e) => {
                    setRemAdminId(e.target.value);
                    setRemOff(0);
                  }}
                  className="h-10 max-w-xs font-mono text-xs"
                />
                <Input
                  type="date"
                  value={remFrom}
                  onChange={(e) => {
                    setRemFrom(e.target.value);
                    setRemOff(0);
                  }}
                  className="h-10"
                />
                <Input
                  type="date"
                  value={remTo}
                  onChange={(e) => {
                    setRemTo(e.target.value);
                    setRemOff(0);
                  }}
                  className="h-10"
                />
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[800px] border-collapse text-left text-xs">
                  <thead className="bg-surface-muted/60 text-[10px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Admin</th>
                      <th className="px-2 py-2">Action</th>
                      <th className="px-2 py-2">IP</th>
                      <th className="px-2 py-2">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remLoading ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center">
                          <Loader2 className="mx-auto size-5 animate-spin" />
                        </td>
                      </tr>
                    ) : remRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No admin audit rows.
                        </td>
                      </tr>
                    ) : (
                      remRows.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-border/80 hover:bg-surface-muted/50"
                          onClick={() => {
                            setRemDrawer(r);
                            setRemDrawerOpen(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-2 py-2 font-mono text-[10px]">
                            {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                          </td>
                          <td className="max-w-[160px] truncate px-2 py-2 font-mono text-[10px]" title={r.admin_email ?? r.admin_id ?? ""}>
                            {r.admin_email ?? r.admin_id ?? "—"}
                          </td>
                          <td className="max-w-[200px] truncate px-2 py-2 font-mono">{r.action}</td>
                          <td className="max-w-[120px] truncate px-2 py-2 font-mono text-[10px]">
                            {r.ip_address ?? "—"}
                          </td>
                          <td className="max-w-[220px] truncate text-muted-foreground">{r.metadata_preview ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {remTotal} events · page {Math.floor(remOff / PAGE) + 1} /{" "}
                  {Math.max(1, Math.ceil(remTotal / PAGE))}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={remOff <= 0 || remLoading}
                    onClick={() => setRemOff((o) => Math.max(0, o - PAGE))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={remOff + PAGE >= remTotal || remLoading}
                    onClick={() => setRemOff((o) => o + PAGE)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Provider form modal */}
      {formOpen && (formMode !== "create" || isSuper) ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">
              {formMode === "create" ? "Add provider" : "Edit provider"}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Provider name</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
                >
                  <option value="mobile_money">mobile_money</option>
                  <option value="bank">bank</option>
                  <option value="all">all</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Country (config)</label>
                <Input
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  placeholder="UG"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Network (config)</label>
                <Input
                  value={formNetwork}
                  onChange={(e) => setFormNetwork(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  placeholder="MTN"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-border"
                />
                Active (primary for type when checked)
              </label>
              {formErr ? <p className="text-sm text-danger">{formErr}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={formBusy} onClick={() => void submitForm()}>
                {formBusy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ProviderLogsDrawer
        open={logsOpen}
        providerName={logsName}
        logs={logsRows}
        loading={logsLoading}
        onClose={() => setLogsOpen(false)}
      />
      <AuditLogDrawer
        open={platDrawerOpen}
        log={platDrawer}
        onClose={() => setPlatDrawerOpen(false)}
      />
      <RemittanceAuditDrawer
        open={remDrawerOpen}
        log={remDrawer}
        onClose={() => setRemDrawerOpen(false)}
      />
    </div>
  );
}
