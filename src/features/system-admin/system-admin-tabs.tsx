"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const SYSTEM_VIEWPORT =
  "mx-auto flex h-[calc(100dvh-7.5rem)] min-h-0 max-w-[1920px] flex-col gap-3 overflow-hidden sm:h-[calc(100dvh-7rem)]";

export type SystemMainTabId = "overview" | "queue" | "routing" | "rates" | "audit" | "tools";

export const SYSTEM_MAIN_TABS: { id: SystemMainTabId; label: string; superOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Queues" },
  { id: "routing", label: "Routing" },
  { id: "rates", label: "Rates & fees" },
  { id: "audit", label: "Audit" },
  { id: "tools", label: "Tools", superOnly: true },
];

export function parseSystemMainTab(raw: string | null, isSuper: boolean): SystemMainTabId {
  if (raw === "queue" || raw === "routing" || raw === "rates" || raw === "audit") return raw;
  if (raw === "tools" && isSuper) return "tools";
  return "overview";
}

type SegmentedTabsProps<T extends string> = {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border/80 bg-surface-muted/40 p-0.5",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === item.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Fills remaining viewport under header + tab bar; children manage inner scroll. */
export function SystemTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>{children}</div>
  );
}

export function SystemScrollRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}>
      {children}
    </div>
  );
}
