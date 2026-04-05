"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { AdminSmsNotificationLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { NotificationStatusBadge } from "./notification-status-badge";
import { formatSmsPhoneDisplay } from "./notification-utils";

const ProviderResponseViewer = dynamic(
  () => import("./provider-response-viewer").then((m) => m.ProviderResponseViewer),
  {
    ssr: false,
    loading: () => <p className="text-xs text-muted-foreground">Loading JSON viewer…</p>,
  },
);

function DetailItem({
  label,
  value,
  mono,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border/80 py-3 last:border-b-0 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "font-mono text-[13px] break-all",
          emphasize && "font-medium text-danger",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

export type NotificationDetailDrawerProps = {
  open: boolean;
  log: AdminSmsNotificationLogRow | null;
  onClose: () => void;
  onRetry?: (row: AdminSmsNotificationLogRow) => void;
  retrying?: boolean;
};

export function NotificationDetailDrawer({
  open,
  log,
  onClose,
  onRetry,
  retrying,
}: NotificationDetailDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [messageExpanded, setMessageExpanded] = React.useState(false);
  const openRef = React.useRef(open);
  openRef.current = open;
  const holdRef = React.useRef<AdminSmsNotificationLogRow | null>(null);
  if (log) holdRef.current = log;
  const display = log ?? holdRef.current;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) setMessageExpanded(false);
  }, [open, log?.id]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  if (!mounted || !display) return null;

  const st = display.status.toUpperCase();
  const canRetry = st !== "SENT" && Boolean(display.remittance_transaction_id?.trim());
  const messageLong = display.message.length > 280;
  const messageShown =
    messageExpanded || !messageLong ? display.message : `${display.message.slice(0, 280)}…`;

  const content = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="sms-drawer-backdrop"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px]"
            aria-label="Close panel"
            onClick={onClose}
          />
          <motion.aside
            key={`sms-drawer-${display.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sms-drawer-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col border-l border-border bg-surface shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p id="sms-drawer-title" className="text-lg font-semibold tracking-tight text-foreground">
                  SMS log
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{display.id}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
              <NotificationStatusBadge status={display.status} />
              <span className="text-xs text-muted-foreground">
                {format(new Date(display.created_at), "MMM d, yyyy · HH:mm:ss")}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <section className="mb-4 rounded-lg border border-border bg-surface-muted/30 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full message</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{messageShown}</p>
                {messageLong ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 gap-1 px-2 text-xs"
                    onClick={() => setMessageExpanded((v) => !v)}
                  >
                    {messageExpanded ? (
                      <>
                        <ChevronUp className="size-3.5" /> Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5" /> Expand full message
                      </>
                    )}
                  </Button>
                ) : null}
              </section>

              <dl>
                <DetailItem label="Phone" value={formatSmsPhoneDisplay(display.phone_number)} mono />
                <DetailItem
                  label="Dedupe key"
                  value={display.dedupe_key}
                  mono
                />
                <DetailItem
                  label="Remittance transaction id"
                  value={display.remittance_transaction_id}
                  mono
                />
                {display.sibling_logs_for_same_tx > 0 ? (
                  <DetailItem
                    label="Related logs (same tx)"
                    value={`${display.sibling_logs_for_same_tx} other row(s) share this transaction id`}
                  />
                ) : null}
                <DetailItem label="Attempts" value={String(display.attempts)} mono />
                <DetailItem
                  label="Status timeline"
                  value={
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      <li>
                        Created{" "}
                        <span className="font-mono text-foreground">
                          {format(new Date(display.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </span>
                      </li>
                      <li>
                        Last update{" "}
                        <span className="font-mono text-foreground">
                          {format(new Date(display.updated_at), "yyyy-MM-dd HH:mm:ss")}
                        </span>{" "}
                        ({display.status})
                      </li>
                      <li className="text-[11px]">Fine-grained attempt history is not stored; see attempts count.</li>
                    </ul>
                  }
                />
                <DetailItem label="Last error" value={display.last_error} emphasize />
              </dl>

              <div className="mt-4">
                <ProviderResponseViewer value={display.provider_response} />
              </div>
            </div>

            {onRetry ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-2"
                  disabled={!canRetry || retrying}
                  onClick={() => onRetry(display)}
                >
                  {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Retry SMS
                </Button>
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
