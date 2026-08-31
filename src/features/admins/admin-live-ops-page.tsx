"use client";

import * as React from "react";
import Link from "next/link";
import {
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserMinus,
  UserX,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PresenceIndicator } from "@/features/users/user-badges";
import {
  AdminApiError,
  adminRevokeStaffSessions,
  adminStaffMonitor,
  type AdminStaffActivityRow,
  type AdminStaffMonitorResponse,
  type AdminTeamMember,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";
import {
  emailInitials,
  formatExactUtc,
  formatRelativeTime,
  parseClientLabel,
  roleLabel,
  staffActionLabel,
} from "./staff-monitor-format";

const POLL_MS = 15_000;

type PresenceFilter = "all" | "online" | "offline" | "never";

function memberActive(row: AdminTeamMember): boolean {
  return row.isActive ?? row.is_active ?? false;
}

export function AdminLiveOpsPage() {
  const { getAccessToken, refreshAccessToken, user } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const [data, setData] = React.useState<AdminStaffMonitorResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<PresenceFilter>("all");
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const withToken = React.useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      let token = getAccessToken();
      if (!token) throw new AdminApiError("Not signed in", "HTTP_401", 401);
      try {
        return await fn(token);
      } catch (error) {
        if (error instanceof AdminApiError && error.status === 401) {
          const ok = await refreshAccessToken();
          token = ok ? getAccessToken() : null;
          if (token) return await fn(token);
        }
        throw error;
      }
    },
    [getAccessToken, refreshAccessToken],
  );

  const load = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const next = await withToken((token) => adminStaffMonitor(token));
        setData(next);
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : "Could not load admin activity.");
      } finally {
        setLoading(false);
      }
    },
    [withToken],
  );

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin, load]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isSuperAdmin, load]);

  async function forceSignOut(target: AdminTeamMember) {
    setRevokingId(target.id);
    setNotice(null);
    try {
      const out = await withToken((token) => adminRevokeStaffSessions(token, target.id));
      setNotice(out.message);
      setConfirmId(null);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not sign them out.");
    } finally {
      setRevokingId(null);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-foreground">Super admin only</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Live admin monitoring is limited to super administrators.
        </p>
      </div>
    );
  }

  const summary = data?.summary;
  const admins = data?.admins ?? [];
  const filtered = admins.filter((row) => {
    if (filter === "online") return row.is_online === true;
    if (filter === "offline") return row.is_online !== true;
    if (filter === "never") return !row.last_login_at;
    return true;
  });

  const filters: { id: PresenceFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: summary?.total },
    { id: "online", label: "Online", count: summary?.online },
    { id: "offline", label: "Offline", count: summary?.offline },
    { id: "never", label: "Never signed in", count: summary?.never_signed_in },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Live ops</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admins</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Who is on the dashboard right now, when they last signed in, and a live feed of staff
            auth events. Presence refreshes every 15 seconds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-muted px-2.5 py-1 text-[11px] font-medium text-success">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live
            {data?.generated_at ? ` · ${formatRelativeTime(data.generated_at)}` : ""}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {notice ? (
        <div className="rounded-xl border border-success/35 bg-success-muted/30 px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger-muted/30 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Online now"
          value={summary?.online ?? "—"}
          subtitle="Seen in the last 3 minutes"
          icon={Radio}
          accent="success"
        />
        <KpiCard
          title="Team seats"
          value={summary?.total ?? "—"}
          subtitle={`${summary?.active ?? 0} can sign in`}
          icon={Users}
        />
        <KpiCard
          title="Never signed in"
          value={summary?.never_signed_in ?? "—"}
          subtitle="Invited, no first login yet"
          icon={UserMinus}
        />
        <KpiCard
          title="Locked / disabled"
          value={(summary?.locked ?? 0) + (summary?.disabled ?? 0)}
          subtitle={`${summary?.locked ?? 0} locked · ${summary?.disabled ?? 0} disabled`}
          icon={Lock}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                    filter === item.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {typeof item.count === "number" ? (
                    <span className="ml-1 tabular-nums opacity-80">{item.count}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <Link
              href="/settings?tab=team"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
            >
              Invite / disable →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/80 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Presence</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3 text-right">Session</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      Loading live presence…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      No admins match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const isSelf = user?.id === row.id;
                    const active = memberActive(row);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/80 last:border-0 hover:bg-surface-muted/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-muted font-mono text-[11px] font-semibold text-primary">
                                {emailInitials(row.email)}
                              </div>
                              <span
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface",
                                  row.is_online ? "bg-success" : "bg-muted-foreground/40",
                                )}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs text-foreground">{row.email}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px]">
                                  {roleLabel(row.role)}
                                </Badge>
                                {isSelf ? (
                                  <span className="text-[10px] font-medium text-primary">You</span>
                                ) : null}
                                {!active ? (
                                  <span className="text-[10px] font-medium text-danger">Disabled</span>
                                ) : null}
                                {row.is_locked ? (
                                  <span className="text-[10px] font-medium text-warning">Locked</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PresenceIndicator online={row.is_online} lastSeenAt={row.last_seen_at} />
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="text-xs text-foreground"
                            title={formatExactUtc(row.last_login_at)}
                          >
                            {formatRelativeTime(row.last_login_at)}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {row.last_login_ip || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="text-xs text-foreground"
                            title={formatExactUtc(row.last_seen_at)}
                          >
                            {formatRelativeTime(row.last_seen_at)}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {parseClientLabel(row.last_seen_user_agent ?? row.last_login_user_agent)}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {row.last_seen_ip || row.last_login_ip || "—"}
                          {row.active_refresh_sessions ? (
                            <p className="mt-0.5 text-[10px] tabular-nums">
                              {row.active_refresh_sessions} refresh
                              {row.active_refresh_sessions === 1 ? "" : "es"}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">This session</span>
                          ) : confirmId === row.id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs"
                                disabled={revokingId === row.id}
                                onClick={() => void forceSignOut(row)}
                              >
                                Confirm
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => setConfirmId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              disabled={!active || revokingId === row.id}
                              onClick={() => setConfirmId(row.id)}
                            >
                              <UserX className="size-3.5" />
                              Sign out
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ShieldAlert className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Recent staff activity</h2>
          </div>
          <ol className="max-h-[min(640px,70vh)] space-y-0 overflow-y-auto p-2">
            {(data?.recent_activity ?? []).length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                No recent staff events.
              </li>
            ) : (
              data?.recent_activity.map((event) => <ActivityRow key={event.id} event={event} />)
            )}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: AdminStaffActivityRow }) {
  const tone =
    event.action.includes("FAIL") ||
    event.action.includes("LOCKED") ||
    event.action.includes("REUSE")
      ? "danger"
      : event.action.includes("REVOKED") || event.action.includes("LOGOUT")
        ? "warning"
        : event.action.includes("SUCCESS") || event.action.includes("CREATED")
          ? "success"
          : "muted";

  return (
    <li className="rounded-xl px-3 py-2.5 hover:bg-surface-muted/60">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{staffActionLabel(event.action)}</p>
        <p className="shrink-0 text-[10px] tabular-nums text-muted-foreground" title={formatExactUtc(event.created_at)}>
          {formatRelativeTime(event.created_at)}
        </p>
      </div>
      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
        {event.staff_email || event.staff_id || "Unknown admin"}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        <span
          className={cn(
            "mr-1 inline-block size-1.5 rounded-full align-middle",
            tone === "danger" && "bg-danger",
            tone === "warning" && "bg-warning",
            tone === "success" && "bg-success",
            tone === "muted" && "bg-muted-foreground/40",
          )}
        />
        {event.ip_address || "—"}
        {event.user_agent ? ` · ${parseClientLabel(event.user_agent)}` : ""}
      </p>
    </li>
  );
}
