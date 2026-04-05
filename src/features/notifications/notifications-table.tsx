"use client";

import * as React from "react";

import type { AdminSmsNotificationLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { NotificationRow } from "./notification-row";

export type NotificationsTableProps = {
  rows: AdminSmsNotificationLogRow[];
  loading: boolean;
  emptyLabel?: string;
  onOpen: (row: AdminSmsNotificationLogRow) => void;
  onRetry: (row: AdminSmsNotificationLogRow) => void;
  retryingIds: ReadonlySet<string>;
};

export function NotificationsTable({
  rows,
  loading,
  emptyLabel = "No notifications yet",
  onOpen,
  onRetry,
  retryingIds,
}: NotificationsTableProps) {
  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/30 py-16 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border transition-opacity",
        loading && "pointer-events-none opacity-60",
      )}
    >
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Date / time</th>
            <th className="px-3 py-3">Phone</th>
            <th className="px-3 py-3">Message</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Attempts</th>
            <th className="px-3 py-3">Transaction</th>
            <th className="px-3 py-3">Last error</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-surface">
          {rows.map((row) => (
            <NotificationRow
              key={row.id}
              row={row}
              onOpen={onOpen}
              onRetry={onRetry}
              retrying={retryingIds.has(row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
