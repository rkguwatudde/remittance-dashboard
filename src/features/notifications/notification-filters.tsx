"use client";

import * as React from "react";
import { RefreshCw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { SmsQuickFilter } from "./notification-utils";

const QUICK: { id: SmsQuickFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "failed", label: "Failed" },
  { id: "sending", label: "Sending" },
  { id: "sent", label: "Sent" },
  { id: "invalid", label: "Invalid" },
];

const ADVANCED_STATUSES = [
  "SENDING",
  "SENT",
  "FAILED",
  "SKIPPED_INVALID_PHONE",
] as const;

export type NotificationFiltersProps = {
  quickFilter: SmsQuickFilter;
  onQuickFilter: (v: SmsQuickFilter) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  attemptsMin: string;
  onAttemptsMin: (v: string) => void;
  advancedStatusSel: Set<string>;
  onToggleAdvancedStatus: (s: string) => void;
  sort: "created_at_desc" | "created_at_asc";
  onSort: (v: "created_at_desc" | "created_at_asc") => void;
  loading: boolean;
  onRefresh: () => void;
  pollingLive: boolean;
};

export function NotificationFilters({
  quickFilter,
  onQuickFilter,
  filtersOpen,
  onToggleFilters,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  attemptsMin,
  onAttemptsMin,
  advancedStatusSel,
  onToggleAdvancedStatus,
  sort,
  onSort,
  loading,
  onRefresh,
  pollingLive,
}: NotificationFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {QUICK.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onQuickFilter(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              quickFilter === t.id
                ? "border-primary bg-primary-muted text-primary"
                : "border-border bg-surface-muted text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Button
          type="button"
          variant={filtersOpen ? "default" : "secondary"}
          size="sm"
          className="gap-2"
          onClick={onToggleFilters}
        >
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as "created_at_desc" | "created_at_asc")}
            className="rounded bg-transparent text-sm font-medium text-foreground outline-none"
          >
            <option value="created_at_desc">Newest first</option>
            <option value="created_at_asc">Oldest first</option>
          </select>
        </div>
        {pollingLive ? (
          <span className="text-xs text-muted-foreground">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-success align-middle" />{" "}
            Live updates ~12s
          </span>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 md:col-span-2 xl:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">
              Status (when &quot;All&quot; quick tab) — multi-select
            </p>
            <div className="flex flex-wrap gap-2">
              {ADVANCED_STATUSES.map((s) => {
                const on = advancedStatusSel.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={quickFilter !== "all"}
                    onClick={() => onToggleAdvancedStatus(s)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                      quickFilter !== "all" && "opacity-40",
                      on
                        ? "border-primary bg-primary-muted text-primary"
                        : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s === "SKIPPED_INVALID_PHONE" ? "SKIPPED…" : s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Date from</p>
            <Input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Date to</p>
            <Input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Min attempts (≥)</p>
            <Input
              inputMode="numeric"
              value={attemptsMin}
              onChange={(e) => onAttemptsMin(e.target.value)}
              placeholder="e.g. 3"
              className="h-9 font-mono"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
