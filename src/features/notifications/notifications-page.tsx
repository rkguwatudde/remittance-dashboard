"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import {
  AdminApiError,
  adminSmsNotificationLogs,
  adminSmsNotificationRetry,
  type AdminSmsNotificationLogRow,
} from "@/lib/remittance-admin-api";
import { ActivityFeedPanel } from "./activity-feed-panel";
import { FailedNotificationsWidget } from "./failed-notifications-widget";
import { NotificationDetailDrawer } from "./notification-detail-drawer";
import { NotificationFilters } from "./notification-filters";
import { NotificationSearch } from "./notification-search";
import { NotificationsTable } from "./notifications-table";
import { quickFilterToStatusParam, type SmsQuickFilter } from "./notification-utils";

const PAGE_SIZE = 25;
const POLL_MS = 12_000;
const FEED_LIMIT = 22;
const FAILED_LIMIT = 8;

export function NotificationsPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();

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

  return (
    <div className="mx-auto max-w-[1920px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
          SMS delivery audit — search, filter, and re-queue failed sends. Data from{" "}
          <code className="rounded bg-surface-muted px-1 font-mono text-xs">sms_notification_logs</code>.
        </p>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <FailedNotificationsWidget
            items={failedList}
            loading={loading}
            onOpen={openDetail}
            onRetry={(row) => void doRetry(row)}
            retryingIds={retryingIds}
          />

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

      <NotificationDetailDrawer
        open={drawerOpen}
        log={selected}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onRetry={(row) => void doRetry(row)}
        retrying={selected ? retryingIds.has(selected.id) : false}
      />
    </div>
  );
}
