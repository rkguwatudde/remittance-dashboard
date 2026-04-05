"use client";

import * as React from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminSmsNotificationLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { formatSmsPhoneDisplay, relativeSmsTime, truncateMessage } from "./notification-utils";

export type FailedNotificationsWidgetProps = {
  items: AdminSmsNotificationLogRow[];
  loading?: boolean;
  onOpen: (row: AdminSmsNotificationLogRow) => void;
  onRetry: (row: AdminSmsNotificationLogRow) => void;
  retryingIds: ReadonlySet<string>;
};

export function FailedNotificationsWidget({
  items,
  loading,
  onOpen,
  onRetry,
  retryingIds,
}: FailedNotificationsWidgetProps) {
  return (
    <Card className="border-danger/30 bg-danger-muted/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-danger" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Failed notifications</h2>
          <p className="text-[11px] text-muted-foreground">Latest SMS errors — retry re-queues the job</p>
        </div>
      </div>
      {loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading failures…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No failed SMS in this window.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => {
            const retrying = retryingIds.has(row.id);
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border border-border bg-surface p-3 shadow-sm",
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono text-foreground">{formatSmsPhoneDisplay(row.phone_number)}</span>
                    <span>·</span>
                    <span>{relativeSmsTime(row.created_at)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{row.attempts} attempts</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{truncateMessage(row.message, 120)}</p>
                  {row.last_error ? (
                    <p className="text-xs text-danger">{row.last_error}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={() => onOpen(row)}>
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={retrying || !row.remittance_transaction_id?.trim()}
                    onClick={() => onRetry(row)}
                  >
                    {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                    Retry
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
