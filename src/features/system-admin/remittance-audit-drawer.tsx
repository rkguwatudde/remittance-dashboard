"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { AdminRemittanceAuditLogRow } from "@/lib/remittance-admin-api";

const JsonViewer = dynamic(
  () => import("./json-viewer").then((m) => m.JsonViewer),
  { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Loading…</p> },
);

export function RemittanceAuditDrawer({
  open,
  log,
  onClose,
}: {
  open: boolean;
  log: AdminRemittanceAuditLogRow | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const holdRef = React.useRef<AdminRemittanceAuditLogRow | null>(null);
  if (log) holdRef.current = log;
  const d = log ?? holdRef.current;

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

  if (!mounted || !d) return null;

  const content = (
    <AnimatePresence>
      {open ? (
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
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Remittance admin audit</p>
                <p className="font-mono text-[11px] text-muted-foreground break-all">{d.id}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              <dl className="space-y-2 text-sm">
                <div className="grid gap-1 sm:grid-cols-[100px_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">Time</dt>
                  <dd className="font-mono text-xs">{format(new Date(d.created_at), "yyyy-MM-dd HH:mm:ss")}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[100px_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">Admin</dt>
                  <dd className="break-all font-mono text-xs">
                    {d.admin_email ?? d.admin_id ?? "—"}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[100px_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">Action</dt>
                  <dd className="font-mono text-xs break-all">{d.action}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[100px_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">IP</dt>
                  <dd className="font-mono text-xs break-all">{d.ip_address ?? "—"}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[100px_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">User-Agent</dt>
                  <dd className="break-all text-xs opacity-90">{d.user_agent ?? "—"}</dd>
                </div>
              </dl>
              <JsonViewer value={d.metadata} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
