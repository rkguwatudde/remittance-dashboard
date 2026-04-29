"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, Megaphone } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import {
  AdminApiError,
  adminBroadcastRecipients,
  type AdminBroadcastRecipient,
  type AdminBroadcastTarget,
  adminSmsNotificationLogs,
  adminSmsNotificationRetry,
  type AdminSmsNotificationLogRow,
} from "@/lib/remittance-admin-api";
import { ActivityFeedPanel } from "./activity-feed-panel";
import {
  prepareBroadcast,
  sendBroadcastWithToken,
  type BroadcastActionLog,
  type BroadcastComposerInput,
  type BroadcastPreview,
} from "./broadcast-service";
import { FailedNotificationsWidget } from "./failed-notifications-widget";
import { NotificationDetailDrawer } from "./notification-detail-drawer";
import { NotificationFilters } from "./notification-filters";
import { NotificationSearch } from "./notification-search";
import { NotificationsTable } from "./notifications-table";
import { NotificationsTabs, type NotificationsTabId } from "./notifications-tabs";
import { quickFilterToStatusParam, type SmsQuickFilter } from "./notification-utils";

const PAGE_SIZE = 25;
const POLL_MS = 12_000;
const FEED_LIMIT = 22;
const FAILED_LIMIT = 8;
const VALID_TABS: NotificationsTabId[] = ["broadcast", "broadcast-activity", "failed", "live"];

export function NotificationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getAccessToken, refreshAccessToken, user } = useAuth();
  const currentTabParam = searchParams?.get("tab") ?? null;
  const initialTab: NotificationsTabId = VALID_TABS.includes(currentTabParam as NotificationsTabId)
    ? (currentTabParam as NotificationsTabId)
    : "broadcast";

  const [rows, setRows] = React.useState<AdminSmsNotificationLogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [feed, setFeed] = React.useState<AdminSmsNotificationLogRow[]>([]);
  const [failedList, setFailedList] = React.useState<AdminSmsNotificationLogRow[]>([]);

  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [quickFilter, setQuickFilter] = React.useState<SmsQuickFilter>("all");
  const [advancedStatusSel, setAdvancedStatusSel] = React.useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [attemptsMin, setAttemptsMin] = React.useState("");
  const [sort, setSort] = React.useState<"created_at_desc" | "created_at_asc">("created_at_desc");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<AdminSmsNotificationLogRow | null>(null);

  const [retryingIds, setRetryingIds] = React.useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = React.useState<NotificationsTabId>(initialTab);
  const [broadcast, setBroadcast] = React.useState<BroadcastComposerInput>({
    title: "",
    message: "",
    target: "all_users",
    topic: "all_users",
    userIdsRaw: "",
    actionUrl: "",
  });
  const [broadcastPreview, setBroadcastPreview] = React.useState<BroadcastPreview | null>(null);
  const [broadcastError, setBroadcastError] = React.useState<string | null>(null);
  const [broadcastResult, setBroadcastResult] = React.useState<string | null>(null);
  const [broadcastBusy, setBroadcastBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [broadcastLog, setBroadcastLog] = React.useState<BroadcastActionLog[]>([]);
  const [lastBroadcastFingerprint, setLastBroadcastFingerprint] = React.useState<string | null>(null);
  const [recipientQuery, setRecipientQuery] = React.useState("");
  const [recipientOptions, setRecipientOptions] = React.useState<AdminBroadcastRecipient[]>([]);
  const [recipientLoading, setRecipientLoading] = React.useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = React.useState<string[]>([]);

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

  React.useEffect(() => {
    if (!VALID_TABS.includes(currentTabParam as NotificationsTabId)) {
      setActiveTab("broadcast");
      return;
    }
    setActiveTab(currentTabParam as NotificationsTabId);
  }, [currentTabParam]);

  const changeTab = (tab: NotificationsTabId) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("tab", tab);
    router.replace(`${pathname}?${next.toString()}`);
  };

  React.useEffect(() => {
    if (broadcast.target !== "userIds") return;
    const t = window.setTimeout(() => {
      void (async () => {
        setRecipientLoading(true);
        try {
          const users = await withToken((token) =>
            adminBroadcastRecipients(token, {
              q: recipientQuery.trim() || undefined,
              limit: 25,
            }),
          );
          setRecipientOptions(users);
        } catch {
          setRecipientOptions([]);
        } finally {
          setRecipientLoading(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [broadcast.target, recipientQuery, withToken]);

  React.useEffect(() => {
    if (broadcast.target !== "userIds") return;
    setBroadcast((prev) => ({ ...prev, userIdsRaw: selectedRecipientIds.join(",") }));
  }, [selectedRecipientIds, broadcast.target]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 400);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const statusQuery = React.useMemo(() => {
    const preset = quickFilterToStatusParam(quickFilter);
    if (preset) return preset;
    if (advancedStatusSel.size === 0) return undefined;
    return Array.from(advancedStatusSel).sort().join(",");
  }, [quickFilter, advancedStatusSel]);

  const buildMainQuery = React.useCallback(
    (off: number) => {
      let attemptsMinN: number | undefined;
      if (attemptsMin.trim()) {
        const n = parseInt(attemptsMin.trim(), 10);
        if (!Number.isNaN(n) && n > 0) attemptsMinN = n;
      }
      return {
        limit: PAGE_SIZE,
        offset: off,
        sort,
        q: q || undefined,
        status: statusQuery,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        attempts_min: attemptsMinN,
      };
    },
    [sort, q, statusQuery, dateFrom, dateTo, attemptsMin],
  );

  const loadAll = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError("Sign in to load notifications.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mainParams = buildMainQuery(offset);
      const fetchWithRefresh = async () => {
        const run = (tok: string) =>
          Promise.all([
            adminSmsNotificationLogs(tok, mainParams),
            adminSmsNotificationLogs(tok, {
              limit: FEED_LIMIT,
              offset: 0,
              sort: "created_at_desc",
            }),
            adminSmsNotificationLogs(tok, {
              limit: FAILED_LIMIT,
              offset: 0,
              sort: "created_at_desc",
              status: "FAILED",
            }),
          ]);
        let t = getAccessToken();
        if (!t) throw new AdminApiError("Unauthorized", "HTTP_401", 401);
        try {
          return await run(t);
        } catch (err) {
          if (err instanceof AdminApiError && err.status === 401) {
            const ok = await refreshAccessToken();
            const next = ok ? getAccessToken() : null;
            if (next) return await run(next);
          }
          throw err;
        }
      };

      const [main, feedRes, failRes] = await fetchWithRefresh();
      setRows(main.logs);
      setTotal(main.pagination.total);
      setFeed(feedRes.logs);
      setFailedList(failRes.logs);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not load SMS logs.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, refreshAccessToken, buildMainQuery, offset]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void loadAll();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAll]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const toggleAdvancedStatus = (s: string) => {
    setOffset(0);
    setAdvancedStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearFilters = () => {
    setOffset(0);
    setDateFrom("");
    setDateTo("");
    setAttemptsMin("");
    setQuickFilter("all");
    setAdvancedStatusSel(new Set());
    setQInput("");
    setQ("");
  };

  const openDetail = (row: AdminSmsNotificationLogRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const doRetry = async (row: AdminSmsNotificationLogRow) => {
    const token = getAccessToken();
    if (!token) return;
    setRetryingIds((prev) => new Set(prev).add(row.id));
    try {
      const run = async (t: string) => adminSmsNotificationRetry(t, row.id);
      let res: Awaited<ReturnType<typeof adminSmsNotificationRetry>>;
      try {
        res = await run(token);
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          const ok = await refreshAccessToken();
          const next = ok ? getAccessToken() : null;
          if (!next) throw err;
          res = await run(next);
        } else throw err;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? res.log : r)));
      setSelected((prev) => (prev?.id === row.id ? res.log : prev));
      setFailedList((prev) => prev.filter((r) => r.id !== row.id || res.log.status === "FAILED"));
      void loadAll();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Retry failed.");
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const openConfirm = () => {
    setBroadcastError(null);
    setBroadcastResult(null);
    try {
      const prepared = prepareBroadcast(broadcast);
      setBroadcastPreview(prepared.preview);
      setConfirmOpen(true);
    } catch (e) {
      setBroadcastPreview(null);
      setBroadcastError(e instanceof Error ? e.message : "Invalid broadcast payload.");
    }
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const selectAllShownRecipients = () => {
    const ids = recipientOptions.map((u) => u.userId);
    setSelectedRecipientIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearRecipientSelection = () => {
    setSelectedRecipientIds([]);
  };

  const confirmSendBroadcast = async () => {
    if (broadcastBusy) return;
    const adminEmail = user?.email ?? "unknown";
    const nowIso = new Date().toISOString();

    let prepared: ReturnType<typeof prepareBroadcast>;
    try {
      prepared = prepareBroadcast(broadcast);
    } catch (e) {
      setBroadcastError(e instanceof Error ? e.message : "Invalid broadcast payload.");
      return;
    }

    const fingerprint = JSON.stringify(prepared.payload);
    if (lastBroadcastFingerprint === fingerprint) {
      setBroadcastError("Same payload already sent recently. Edit message or target before resending.");
      return;
    }

    setBroadcastBusy(true);
    setBroadcastError(null);
    setBroadcastResult(null);
    try {
      const res = await sendBroadcastWithToken(withToken, prepared.payload);
      setBroadcastResult(`Broadcast queued successfully. Target count: ${res.targetCount}.`);
      setLastBroadcastFingerprint(fingerprint);
      setConfirmOpen(false);
      setBroadcastLog((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          adminEmail,
          createdAtIso: nowIso,
          payload: prepared.preview,
          status: "sent",
          detail: `Queued with targetCount=${res.targetCount}`,
        },
        ...prev.slice(0, 9),
      ]);
    } catch (e) {
      const detail = e instanceof AdminApiError ? e.message : "Failed to queue broadcast.";
      setBroadcastError(detail);
      setBroadcastLog((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          adminEmail,
          createdAtIso: nowIso,
          payload: prepared.preview,
          status: "failed",
          detail,
        },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setBroadcastBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1920px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
          SMS delivery audit — search, filter, and re-queue failed sends. Data from{" "}
          <code className="rounded bg-surface-muted px-1 font-mono text-xs">sms_notification_logs</code>.
        </p>
      </div>

      <NotificationsTabs activeTab={activeTab} onChange={changeTab} />

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-danger">{error}</p>
          <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => void loadAll()}>
            Retry request
          </Button>
        </div>
      ) : null}

      {activeTab === "broadcast" ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4" />
            Push Broadcast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Title</label>
              <Input
                value={broadcast.title}
                onChange={(e) => setBroadcast((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Maintenance update"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Target</label>
              <select
                value={broadcast.target}
                onChange={(e) =>
                  setBroadcast((prev) => ({ ...prev, target: e.target.value as AdminBroadcastTarget }))
                }
                className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm"
              >
                <option value="all_users">All users</option>
                <option value="topic">Specific topic</option>
                <option value="userIds">Specific user IDs</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Message body</label>
            <textarea
              value={broadcast.message}
              onChange={(e) => setBroadcast((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="We are performing scheduled maintenance between 02:00 and 03:00."
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Action URL (optional)</label>
            <Input
              value={broadcast.actionUrl}
              onChange={(e) => setBroadcast((prev) => ({ ...prev, actionUrl: e.target.value }))}
              placeholder="borabond://notifications"
              className="mt-1"
            />
          </div>

          {broadcast.target === "topic" ? (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Topic</label>
              <Input
                value={broadcast.topic}
                onChange={(e) => setBroadcast((prev) => ({ ...prev, topic: e.target.value }))}
                placeholder="all_users"
                className="mt-1 font-mono text-xs"
              />
            </div>
          ) : null}

          {broadcast.target === "userIds" ? (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Select recipients</label>
              <Input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder="Search by user id, email, name, phone"
                className="mt-1"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Selected recipients: {selectedRecipientIds.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={recipientLoading || recipientOptions.length === 0}
                    onClick={selectAllShownRecipients}
                  >
                    Select all shown
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={selectedRecipientIds.length === 0}
                    onClick={clearRecipientSelection}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
                {recipientLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Loading recipients...</p>
                ) : recipientOptions.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    No users with active device tokens found.
                  </p>
                ) : (
                  recipientOptions.map((u) => {
                    const selected = selectedRecipientIds.includes(u.userId);
                    return (
                      <label
                        key={u.userId}
                        className="flex cursor-pointer items-start gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRecipient(u.userId)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">
                            {u.fullName || u.email || u.userId}
                          </span>
                          <span className="block font-mono text-muted-foreground">
                            {u.userId}
                            {u.email ? ` · ${u.email}` : ""}
                            {u.phone ? ` · ${u.phone}` : ""}
                            {` · ${u.tokenCount} token${u.tokenCount === 1 ? "" : "s"}`}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          <div className="rounded-md border border-border bg-surface-muted/30 p-3 text-xs">
            <p className="mb-2 font-semibold text-foreground">Preview</p>
            <p>
              <span className="text-muted-foreground">Title:</span> {broadcast.title || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Body:</span> {broadcast.message || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Target:</span> {broadcast.target}
            </p>
            <p>
              <span className="text-muted-foreground">Action URL:</span> {broadcast.actionUrl.trim() || "—"}
            </p>
          </div>

          {broadcastError ? <p className="text-sm text-danger">{broadcastError}</p> : null}
          {broadcastResult ? <p className="text-sm text-success">{broadcastResult}</p> : null}

          <div className="flex justify-end">
            <Button type="button" disabled={broadcastBusy} onClick={openConfirm}>
              {broadcastBusy ? <Loader2 className="size-4 animate-spin" /> : "Send Broadcast"}
            </Button>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {activeTab === "broadcast-activity" ? (
      <>
      {broadcastLog.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Broadcast Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {broadcastLog.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-muted-foreground">{entry.createdAtIso}</span>
                  <Badge variant={entry.status === "sent" ? "success" : "destructive"}>
                    {entry.status}
                  </Badge>
                </div>
                <p>
                  <span className="text-muted-foreground">Admin:</span> {entry.adminEmail}
                </p>
                <p>
                  <span className="text-muted-foreground">Target:</span> {entry.payload.target}
                </p>
                <p>
                  <span className="text-muted-foreground">Title:</span> {entry.payload.title}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {entry.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Broadcast Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No broadcasts have been sent in this session yet.
            </p>
          </CardContent>
        </Card>
      )}
      </>
      ) : null}

      {activeTab === "failed" ? (
        <FailedNotificationsWidget
          items={failedList}
          loading={loading}
          onOpen={openDetail}
          onRetry={(row) => void doRetry(row)}
          retryingIds={retryingIds}
        />
      ) : null}

      {activeTab === "live" ? (
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <NotificationSearch value={qInput} onChange={setQInput} disabled={loading} />
                <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearFilters}>
                  Clear search & filters
                </Button>
              </div>

              <NotificationFilters
                quickFilter={quickFilter}
                onQuickFilter={(v) => {
                  setOffset(0);
                  setQuickFilter(v);
                }}
                filtersOpen={filtersOpen}
                onToggleFilters={() => setFiltersOpen((x) => !x)}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFrom={(v) => {
                  setDateFrom(v);
                  setOffset(0);
                }}
                onDateTo={(v) => {
                  setDateTo(v);
                  setOffset(0);
                }}
                attemptsMin={attemptsMin}
                onAttemptsMin={(v) => {
                  setAttemptsMin(v);
                  setOffset(0);
                }}
                advancedStatusSel={advancedStatusSel}
                onToggleAdvancedStatus={toggleAdvancedStatus}
                sort={sort}
                onSort={(v) => {
                  setSort(v);
                  setOffset(0);
                }}
                loading={loading}
                onRefresh={() => void loadAll()}
                pollingLive
              />

              {loading && rows.length === 0 ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <NotificationsTable
                  rows={rows}
                  loading={loading && rows.length > 0}
                  onOpen={openDetail}
                  onRetry={(row) => void doRetry(row)}
                  retryingIds={retryingIds}
                />
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  <span className="tabular-nums">{total}</span> logs · page{" "}
                  <span className="tabular-nums">{page}</span> /{" "}
                  <span className="tabular-nums">{pageCount}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={offset <= 0 || loading}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    className="gap-1"
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total || loading}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <ActivityFeedPanel items={feed} onSelect={openDetail} loading={loading && feed.length === 0} />
        </div>
      </div>
      ) : null}

      <NotificationDetailDrawer
        open={drawerOpen}
        log={selected}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onRetry={(row) => void doRetry(row)}
        retrying={selected ? retryingIds.has(selected.id) : false}
      />

      {confirmOpen && broadcastPreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Confirm broadcast</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to send this broadcast to{" "}
              {broadcastPreview.target === "all_users"
                ? "all users"
                : broadcastPreview.target === "topic"
                  ? `topic "${broadcastPreview.topic}"`
                  : `${broadcastPreview.userIds.length} selected user(s)`}
              ?
            </p>
            <div className="mt-3 rounded-md border border-border bg-surface-muted/30 p-3 text-xs">
              <p>
                <span className="text-muted-foreground">Title:</span> {broadcastPreview.title}
              </p>
              <p>
                <span className="text-muted-foreground">Body:</span> {broadcastPreview.message}
              </p>
              {broadcastPreview.data.action_url ? (
                <p>
                  <span className="text-muted-foreground">Action URL:</span>{" "}
                  {broadcastPreview.data.action_url}
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={broadcastBusy} onClick={() => void confirmSendBroadcast()}>
                {broadcastBusy ? <Loader2 className="size-4 animate-spin" /> : "Confirm & Send"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
