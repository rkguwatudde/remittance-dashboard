"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function JsonViewer({
  value,
  className,
  defaultOpen = true,
}: {
  value: unknown;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  if (value == null) {
    return <p className={cn("text-xs text-muted-foreground", className)}>—</p>;
  }

  return (
    <div className={cn("rounded-lg border border-border bg-surface-muted/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">JSON</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? (
        <pre className="max-h-[min(55vh,480px)] overflow-auto p-2 font-mono text-[11px] leading-relaxed">
          {text}
        </pre>
      ) : null}
    </div>
  );
}
