"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { QueuePage } from "@/features/queue/queue-page";
import {
  parseSystemMainTab,
  SegmentedTabs,
  SYSTEM_MAIN_TABS,
  SYSTEM_VIEWPORT,
  SystemScrollRegion,
  SystemTabPanel,
  type SystemMainTabId,
} from "./system-admin-tabs";

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

  const searchParams = useSearchParams();
  const router = useRouter();
  const mainTab = parseSystemMainTab(searchParams?.get("tab") ?? null, isSuper);
  const setMainTab = React.useCallback(
    (id: SystemMainTabId) => {
      router.replace(`/system?tab=${id}`, { scroll: false });
    },
    [router],
  );

  const [routingSub, setRoutingSub] = React.useState<"mobile" | "banks">(
    isSuper ? "mobile" : "banks",
  );
  const [ratesSub, setRatesSub] = React.useState<"consumer" | "business">("consumer");

  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  React.useEffect(() => {
    if (!isSuper && routingSub === "mobile") setRoutingSub("banks");
  }, [isSuper, routingSub]);

  const visibleMainTabs = SYSTEM_MAIN_TABS.filter((t) => !t.superOnly || isSuper);

  return (
    <div className={SYSTEM_VIEWPORT}>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            System
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Health, routing, rates, and audit — auto-refreshes every {POLL_MS / 1000}s
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 gap-2 rounded-lg"
          disabled={ovLoading}
          onClick={() => void loadOverview()}
        >
          <RefreshCw className={cn("size-4", ovLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <SegmentedTabs
        className="shrink-0 w-full sm:w-auto"
        items={visibleMainTabs.map((t) => ({ id: t.id, label: t.label }))}
        value={mainTab}
        onChange={setMainTab}
      />

      {ovError ? (
        <div className="flex shrink-0 flex-col gap-2 rounded-lg border border-danger/40 bg-danger-muted/25 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-danger">{ovError}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void loadOverview()}>
            Retry
          </Button>
        </div>
      ) : null}

      {showAnomalyBanner && mainTab === "overview" ? (
        <div className="shrink-0 rounded-lg border border-warning/50 bg-warning-muted/25 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="size-3.5 shrink-0" />
            Unusual activity (1h)
          </div>
          <p className="mt-1 line-clamp-2 font-mono text-[11px] text-foreground">
            {[
              anomalies!.highTrafficIps.length
                ? anomalies!.highTrafficIps.map((x) => `${x.ip_address} (${x.count})`).join("; ")
                : null,
              anomalies!.repeatedFailures.length
                ? anomalies!.repeatedFailures.map((x) => `${x.action}×${x.count}`).join(", ")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      <SystemTabPanel>
      {mainTab === "overview" ? (
      <SystemScrollRegion className="flex flex-col gap-3 pr-0.5">
      <div className="grid gap-3 lg:grid-cols-3">
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
          <CardContent className="h-28 sm:h-32">
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1h requests", overview.apiMetrics.last1h.totalRequests],
            ["1h success", `${overview.apiMetrics.last1h.successRate}%`],
            ["24h requests", overview.apiMetrics.last24h.totalRequests],
            ["24h err rate", `${overview.apiMetrics.last24h.errorRatePercent}%`],
          ].map(([label, val]) => (
            <Card key={label as string} className="border-border/80">
              <CardContent className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-0.5 font-mono text-base text-foreground">{val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      </SystemScrollRegion>
      ) : null}

      {mainTab === "queue" ? <QueuePage embeddedInSystem /> : null}

      {mainTab === "routing" ? (
        <>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedTabs
              size="sm"
              items={
                isSuper
                  ? [
                      { id: "mobile" as const, label: "Mobile money" },
                      { id: "banks" as const, label: "Banks" },
                    ]
                  : [{ id: "banks" as const, label: "Banks" }]
              }
              value={routingSub}
              onChange={setRoutingSub}
            />
            {routingSub === "mobile" && isSuper ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Country"
                  value={mmFilterCountry}
                  onChange={(e) => setMmFilterCountry(e.target.value)}
                  className="h-8 w-28 font-mono text-xs"
                />
                <select
                  value={mmFilterActive}
                  onChange={(e) => setMmFilterActive(e.target.value as typeof mmFilterActive)}
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Disabled</option>
                </select>
                <Button type="button" size="sm" className="h-8 gap-1" onClick={startCreateMm}>
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            ) : (
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search bank / code"
                  value={bankQ}
                  onChange={(e) => setBankQ(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          {routingSub === "mobile" && isSuper ? (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80">
        <CardContent className="min-h-0 flex-1 overflow-auto overscroll-contain p-0">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-surface-muted/95 text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur [&>tr>th]:px-3 [&>tr>th]:py-2">
              <tr>
                <th>Name</th>
                <th>Country</th>
                <th>Network</th>
                <th>Routing</th>
                <th>Health</th>
                <th>Last check</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mmRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No providers match filters.
                  </td>
                </tr>
              ) : (
                mmRows.map((r) => {
                  const h = healthByName.get(r.providerName.toLowerCase());
                  return (
                    <tr key={r.id} className="border-b border-border/70 hover:bg-surface-muted/35">
                      <td className="px-3 py-1.5 font-mono">{r.providerName}</td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.country ?? (r.config?.country as string) ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.network ?? (r.config?.network as string) ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant={r.isActive ? "success" : "secondary"} className="h-5 px-1.5 text-[10px]">
                          {r.isActive ? "Active" : "Off"}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        {h ? (
                          <Badge variant={statusBadge(h.uiStatus)} className="h-5 px-1.5 text-[10px]">
                            {h.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                        {h?.lastCheckedAt
                          ? format(new Date(h.lastCheckedAt), "MMM d HH:mm")
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => startEditMm(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => openLogs(r.providerName.toLowerCase())}
                          >
                            Logs
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 text-danger"
                            onClick={() => void deleteProvider(r.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
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
          ) : (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80">
        <CardContent className="min-h-0 flex-1 overflow-auto overscroll-contain p-0">
          {banksLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading banks…</p>
          ) : filteredBanks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No banks match.</p>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-muted/95 backdrop-blur">
                <tr className="text-[10px] font-semibold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Operate time</th>
                </tr>
              </thead>
              <tbody>
                {filteredBanks.map((b) => (
                  <tr key={b.bankCode} className="border-b border-border/70 hover:bg-surface-muted/30">
                    <td className="px-3 py-1.5">{b.bankName}</td>
                    <td className="px-3 py-1.5 font-mono">{b.bankCode}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="success" className="h-5 px-1.5 text-[10px]">
                        Online
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {b.operateTime ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
          )}
        </>
      ) : null}

      {mainTab === "rates" ? (
        <>
          <div className="shrink-0">
            <SegmentedTabs
              size="sm"
              items={[
                { id: "consumer" as const, label: "Customer remittance" },
                { id: "business" as const, label: "Business corridors" },
              ]}
              value={ratesSub}
              onChange={setRatesSub}
            />
          </div>
          <SystemScrollRegion className="space-y-3 pr-0.5">
            {ratesSub === "consumer" ? (
              <ExchangeRatesCard withToken={withToken} isSuper={isSuper} />
            ) : (
              <BusinessRatesCard withToken={withToken} isSuper={isSuper} />
            )}
          </SystemScrollRegion>
        </>
      ) : null}

      {mainTab === "audit" ? (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80">
        <CardHeader className="shrink-0 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-border py-3">
          <CardTitle className="text-sm font-semibold">Audit trail</CardTitle>
          <SegmentedTabs
            size="sm"
            items={[
              { id: "platform" as const, label: "Platform" },
              { id: "remittance" as const, label: "Remittance admins" },
            ]}
            value={auditTab}
            onChange={setAuditTab}
          />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 pt-3">
          {auditTab === "platform" ? (
            <>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={platQIn}
                    onChange={(e) => setPlatQIn(e.target.value)}
                    placeholder="Search entity, actor, metadata…"
                    className="h-8 pl-8 font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setPlatFiltersOpen((v) => !v)}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                </Button>
              </div>
              {platFiltersOpen ? (
                <div className="grid shrink-0 gap-2 rounded-lg border border-border/80 bg-surface-muted/25 p-2 md:grid-cols-3 lg:grid-cols-4">
                  <Input placeholder="action" value={platAction} onChange={(e) => { setPlatAction(e.target.value); setPlatOff(0); }} className="h-8 font-mono text-xs" />
                  <Input placeholder="entity_type" value={platEntity} onChange={(e) => { setPlatEntity(e.target.value); setPlatOff(0); }} className="h-8 font-mono text-xs" />
                  <Input placeholder="actor_type" value={platActor} onChange={(e) => { setPlatActor(e.target.value); setPlatOff(0); }} className="h-8 font-mono text-xs" />
                  <Input placeholder="user_id" value={platUserId} onChange={(e) => { setPlatUserId(e.target.value); setPlatOff(0); }} className="h-8 font-mono text-xs" />
                  <Input placeholder="device" value={platDevice} onChange={(e) => { setPlatDevice(e.target.value); setPlatOff(0); }} className="h-8 font-mono text-xs" />
                  <Input type="date" value={platFrom} onChange={(e) => { setPlatFrom(e.target.value); setPlatOff(0); }} className="h-8 text-xs" />
                  <Input type="date" value={platTo} onChange={(e) => { setPlatTo(e.target.value); setPlatOff(0); }} className="h-8 text-xs" />
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-border/80">
                <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-surface-muted/95 text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-2 py-1.5">Time</th>
                      <th className="px-2 py-1.5">Action</th>
                      <th className="px-2 py-1.5">Entity</th>
                      <th className="px-2 py-1.5">Actor</th>
                      <th className="px-2 py-1.5">User</th>
                      <th className="px-2 py-1.5">Device</th>
                      <th className="px-2 py-1.5">IP</th>
                      <th className="px-2 py-1.5">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platLoading ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">
                          <Loader2 className="mx-auto size-5 animate-spin" />
                        </td>
                      </tr>
                    ) : platRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">
                          No audit rows.
                        </td>
                      </tr>
                    ) : (
                      platRows.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-border/70 hover:bg-surface-muted/40"
                          onClick={() => {
                            setPlatDrawer(r);
                            setPlatDrawerOpen(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                            {format(new Date(r.created_at), "MM-dd HH:mm")}
                          </td>
                          <td className="max-w-[120px] truncate px-2 py-1.5 font-mono">{r.action}</td>
                          <td className="max-w-[120px] truncate px-2 py-1.5 font-mono" title={`${r.entity_type}:${r.entity_id}`}>
                            {r.entity_type}
                          </td>
                          <td className="max-w-[90px] truncate px-2 py-1.5 font-mono text-[10px]">{r.actor_type}</td>
                          <td className="max-w-[80px] truncate px-2 py-1.5 font-mono text-[10px]">{r.user_id ?? "—"}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px]">{r.device ?? "—"}</td>
                          <td className="max-w-[90px] truncate px-2 py-1.5 font-mono text-[10px]">{r.ip_address ?? "—"}</td>
                          <td className="max-w-[140px] truncate px-2 py-1.5 text-[10px] text-muted-foreground" title={r.metadata_preview ?? ""}>
                            {r.metadata_preview ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {platTotal} events · {Math.floor(platOff / PAGE) + 1}/{Math.max(1, Math.ceil(platTotal / PAGE))}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="secondary" size="sm" className="h-7 w-7 p-0" disabled={platOff <= 0 || platLoading} onClick={() => setPlatOff((o) => Math.max(0, o - PAGE))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 w-7 p-0" disabled={platOff + PAGE >= platTotal || platLoading} onClick={() => setPlatOff((o) => o + PAGE)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={remQIn}
                    onChange={(e) => setRemQIn(e.target.value)}
                    placeholder="Search action / metadata"
                    className="h-8 pl-8 font-mono text-xs"
                  />
                </div>
                <Input placeholder="admin_id" value={remAdminId} onChange={(e) => { setRemAdminId(e.target.value); setRemOff(0); }} className="h-8 max-w-[200px] font-mono text-xs" />
                <Input type="date" value={remFrom} onChange={(e) => { setRemFrom(e.target.value); setRemOff(0); }} className="h-8 w-[130px] text-xs" />
                <Input type="date" value={remTo} onChange={(e) => { setRemTo(e.target.value); setRemOff(0); }} className="h-8 w-[130px] text-xs" />
              </div>
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-border/80">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-surface-muted/95 text-[10px] font-semibold uppercase text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-2 py-1.5">Time</th>
                      <th className="px-2 py-1.5">Admin</th>
                      <th className="px-2 py-1.5">Action</th>
                      <th className="px-2 py-1.5">IP</th>
                      <th className="px-2 py-1.5">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center">
                          <Loader2 className="mx-auto size-5 animate-spin" />
                        </td>
                      </tr>
                    ) : remRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No admin audit rows.
                        </td>
                      </tr>
                    ) : (
                      remRows.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-border/70 hover:bg-surface-muted/40"
                          onClick={() => {
                            setRemDrawer(r);
                            setRemDrawerOpen(true);
                          }}
                        >
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]">
                            {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-1.5 font-mono text-[10px]" title={r.admin_email ?? r.admin_id ?? ""}>
                            {r.admin_email ?? r.admin_id ?? "—"}
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-1.5 font-mono">{r.action}</td>
                          <td className="max-w-[100px] truncate px-2 py-1.5 font-mono text-[10px]">{r.ip_address ?? "—"}</td>
                          <td className="max-w-[200px] truncate px-2 py-1.5 text-[10px] text-muted-foreground">{r.metadata_preview ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {remTotal} events · {Math.floor(remOff / PAGE) + 1}/{Math.max(1, Math.ceil(remTotal / PAGE))}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="secondary" size="sm" className="h-7 w-7 p-0" disabled={remOff <= 0 || remLoading} onClick={() => setRemOff((o) => Math.max(0, o - PAGE))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button type="button" variant="secondary" size="sm" className="h-7 w-7 p-0" disabled={remOff + PAGE >= remTotal || remLoading} onClick={() => setRemOff((o) => o + PAGE)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      ) : null}

      {mainTab === "tools" && isSuper ? (
        <SystemScrollRegion>
          <Card className="mx-auto max-w-2xl border-border/80">
            <CardHeader>
              <CardTitle className="text-base">Push broadcast (test)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Title</label>
                  <Input
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Maintenance update"
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Target</label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value as AdminBroadcastTarget)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
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
                <Input
                  value={broadcastTopic}
                  onChange={(e) => setBroadcastTopic(e.target.value)}
                  placeholder="Topic"
                  className="font-mono text-xs"
                />
              ) : null}
              {broadcastTarget === "userIds" ? (
                <textarea
                  value={broadcastUserIdsRaw}
                  onChange={(e) => setBroadcastUserIdsRaw(e.target.value)}
                  placeholder="User IDs (comma or newline)"
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                />
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
        </SystemScrollRegion>
      ) : null}

      </SystemTabPanel>

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
