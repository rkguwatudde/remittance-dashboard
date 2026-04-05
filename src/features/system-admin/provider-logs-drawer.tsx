"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProviderMetricLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

export function ProviderLogsDrawer({
  open,
  providerName,
  logs,
  loading,
  onClose,
}: {
  open: boolean;
  providerName: string | null;
  logs: ProviderMetricLogRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return;
  }, [open]);

  if (!mounted) return null;

  const content = (
    <AnimatePresence>
      {open && providerName ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Provider request log</p>
                <p className="font-mono text-xs text-muted-foreground">{providerName}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No metric rows in the sampled window.</p>
              ) : (
                <ul className="space-y-2">
                  {logs.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border bg-surface-muted/40 p-2 text-[11px]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={r.status === "success" ? "success" : "destructive"}
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                        <span className="font-mono tabular-nums text-foreground">{r.responseTimeMs} ms</span>
                        {r.httpStatus != null ? (
                          <span className="text-muted-foreground">HTTP {r.httpStatus}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all font-mono text-muted-foreground">{r.endpoint}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
