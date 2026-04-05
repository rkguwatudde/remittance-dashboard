"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { AdminSavedRecipientRow } from "@/lib/remittance-admin-api";

import { maskAccountNumber } from "./recipient-utils";

type DeleteRecipientDialogProps = {
  open: boolean;
  recipient: AdminSavedRecipientRow | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirmDisable: () => void;
};

export function DeleteRecipientDialog({
  open,
  recipient,
  loading,
  onCancel,
  onConfirmDisable,
}: DeleteRecipientDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onCancel]);

  if (!mounted || !recipient) return null;

  const content = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-foreground/25 backdrop-blur-[1px]"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-floating)]"
          >
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-muted text-warning">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 id="del-title" className="text-base font-semibold text-foreground">
                  Disable this recipient?
                </h2>
                <p className="text-sm text-muted-foreground">
                  They will no longer appear in active lists. This is a soft delete — history is
                  preserved.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-surface-muted/80 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{recipient.recipient_name}</p>
              <p className="mt-1 text-muted-foreground">
                {recipient.transfer_type === "mobile_money"
                  ? recipient.phone_number
                  : `${recipient.bank_name ?? "Bank"} · ${maskAccountNumber(recipient.account_number)}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Customer: {recipient.customer_email ?? recipient.user_id}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={loading} onClick={onConfirmDisable}>
                {loading ? "Working…" : "Disable recipient"}
              </Button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
