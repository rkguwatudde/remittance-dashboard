"use client";

import * as React from "react";
import { Radio } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { AdminSmsNotificationLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { NotificationStatusBadge } from "./notification-status-badge";
import {
  activitySortPriority,
  formatSmsPhoneDisplay,
  relativeSmsTime,
  truncateMessage,
} from "./notification-utils";

export type ActivityFeedPanelProps = {
  items: AdminSmsNotificationLogRow[];
  onSelect: (row: AdminSmsNotificationLogRow) => void;
  loading?: boolean;
};

export function ActivityFeedPanel({ items, onSelect, loading }: ActivityFeedPanelProps) {
  const sorted = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const pa = activitySortPriority(a.status);
      const pb = activitySortPriority(b.status);
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items]);

  return (
    <Card className="flex max-h-[min(85vh,900px)] flex-col overflow-hidden border-border p-0">
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted/40 px-4 py-3">
        <Radio className="size-4 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Live activity</p>
          <p className="text-[11px] text-muted-foreground">Failures surface first · click for detail</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Loading feed…</p>
        ) : sorted.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No recent events.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((row) => {
              const failed = row.status.toUpperCase() === "FAILED";
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-muted/70",
                      failed && "bg-danger-muted/10 hover:bg-danger-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <NotificationStatusBadge status={row.status} className="text-[10px]" />
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeSmsTime(row.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{truncateMessage(row.message, 80)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {formatSmsPhoneDisplay(row.phone_number)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
