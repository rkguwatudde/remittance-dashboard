"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function collectKeys(a: Record<string, unknown> | null, b: Record<string, unknown> | null): string[] {
  const s = new Set<string>();
  if (a) for (const k of Object.keys(a)) s.add(k);
  if (b) for (const k of Object.keys(b)) s.add(k);
  return Array.from(s).sort();
}

function fmt(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function DiffViewer({
  oldValues,
  newValues,
  className,
}: {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  className?: string;
}) {
  if (!oldValues && !newValues) {
    return <p className={cn("text-xs text-muted-foreground", className)}>No before/after payload.</p>;
  }

  const keys = collectKeys(oldValues, newValues);

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full min-w-[500px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted/60 font-mono">
            <th className="px-2 py-2 font-semibold text-muted-foreground">Field</th>
            <th className="px-2 py-2 font-semibold text-danger">Before</th>
            <th className="px-2 py-2 font-semibold text-success">After</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {keys.map((k) => {
            const o = oldValues?.[k];
            const n = newValues?.[k];
            const changed = fmt(o) !== fmt(n);
            return (
              <tr
                key={k}
                className={cn(
                  "border-b border-border/80",
                  changed ? "bg-warning-muted/25" : "bg-surface",
                )}
              >
                <td className="max-w-[140px] break-all px-2 py-1.5 text-foreground">{k}</td>
                <td className="max-w-[240px] break-all px-2 py-1.5 text-muted-foreground">{fmt(o)}</td>
                <td className="max-w-[240px] break-all px-2 py-1.5 text-foreground">{fmt(n)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
