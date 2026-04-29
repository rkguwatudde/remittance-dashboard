"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type NotificationsTabId = "broadcast" | "broadcast-activity" | "failed" | "live";

const TAB_ITEMS: Array<{ id: NotificationsTabId; label: string }> = [
  { id: "broadcast", label: "Push Broadcast" },
  { id: "broadcast-activity", label: "Broadcast Activity" },
  { id: "failed", label: "Failed Notifications" },
  { id: "live", label: "Live Activity" },
];

export function NotificationsTabs(props: {
  activeTab: NotificationsTabId;
  onChange: (tab: NotificationsTabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface-muted/40 p-1">
      {TAB_ITEMS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => props.onChange(tab.id)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            props.activeTab === tab.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
          )}
          aria-pressed={props.activeTab === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
