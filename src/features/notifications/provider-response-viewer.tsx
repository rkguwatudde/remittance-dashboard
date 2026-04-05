"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProviderResponseViewer({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  const [open, setOpen] = React.useState(true);
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  if (value == null) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>No provider response recorded.</p>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-surface-muted/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Provider response
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {open ? "Collapse" : "Expand"}
        </Button>
      </div>
      {open ? (
        <pre className="max-h-[min(50vh,420px)] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground">
          {text}
        </pre>
      ) : null}
    </div>
  );
}
