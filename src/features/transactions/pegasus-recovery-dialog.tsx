"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AdminPegasusRecoveryState,
  AdminRemittanceTransactionRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

export type PegasusRecoveryAction = "poll_retry" | "repost";

type PegasusRecoveryDialogProps = {
  open: boolean;
  action: PegasusRecoveryAction;
  transaction: AdminRemittanceTransactionRow;
  recovery: AdminPegasusRecoveryState | null | undefined;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: {
    confirmPlatformTransactionId: string;
    reason: string;
    acknowledgeDuplicatePayoutRisk?: boolean;
    confirmVendorAbsentOnPegasus?: boolean;
  }) => void;
};

export function PegasusRecoveryDialog({
  open,
  action,
  transaction,
  recovery,
  loading,
  onCancel,
  onConfirm,
}: PegasusRecoveryDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const platformId = transaction.platform_transaction_id?.trim() ?? "";
  const [confirmId, setConfirmId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [dupRisk, setDupRisk] = React.useState(false);
  const [vendorAbsent, setVendorAbsent] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setConfirmId("");
      setReason("");
      setDupRisk(false);
      setVendorAbsent(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onCancel]);

  if (!mounted || !platformId) return null;

  const isRepost = action === "repost";
  const needsVendorAbsent = Boolean(recovery?.repostRequiresVendorAbsentConfirmation);
  const idOk = confirmId.trim().toUpperCase() === platformId.toUpperCase();
  const reasonOk = reason.trim().length >= 10;
  const checksOk = isRepost ? dupRisk && (!needsVendorAbsent || vendorAbsent) : true;
  const canSubmit = idOk && reasonOk && checksOk && !loading;

  const title = isRepost ? "Post again to Pegasus" : "Poll existing Pegasus vendor ref";
  const vendorRef =
    recovery?.providerReference?.trim() ||
    transaction.provider_reference?.trim() ||
    "—";

  const content = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-foreground/30 backdrop-blur-[1px]"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pegasus-recovery-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-[110] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-floating)]"
          >
            <div className="flex gap-3">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  isRepost ? "bg-destructive/15 text-destructive" : "bg-warning-muted text-warning",
                )}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 id="pegasus-recovery-title" className="text-base font-semibold text-foreground">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Production action — server validates eligibility, records your user id and reason,
                  and rejects mismatched confirmations.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl bg-surface-muted/80 px-4 py-3 text-sm">
              <p>
                <span className="text-muted-foreground">Platform Tx ID</span>{" "}
                <span className="font-mono font-medium text-foreground">{platformId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Pegasus vendor ref</span>{" "}
                <span className="font-mono text-[13px] break-all text-foreground">{vendorRef}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Receive</span>{" "}
                {formatLedgerAmount(transaction)}
              </p>
            </div>

            {isRepost ? (
              <p className="mt-3 text-xs leading-relaxed text-destructive">
                Repost sends a new PostTransaction. If the first payout actually reached the
                recipient, this can duplicate funds. Use only when Pegasus confirms the vendor ref
                above does not exist.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Poll retry does not send money again. Use only when PostTransaction was accepted and
                GetTransactionDetails timed out on code 16.
              </p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="pegasus-confirm-id">
                  Type Platform Tx ID to confirm
                </label>
                <Input
                  id="pegasus-confirm-id"
                  className="mt-1 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                  value={confirmId}
                  onChange={(e) => setConfirmId(e.target.value)}
                  placeholder={platformId}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground" htmlFor="pegasus-reason">
                  Reason / ticket (min 10 characters)
                </label>
                <Input
                  id="pegasus-reason"
                  className="mt-1 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Pegasus confirmed vendor missing; incident #…"
                />
              </div>
            </div>

            {isRepost ? (
              <div className="mt-4 space-y-2 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={dupRisk}
                    onChange={(e) => setDupRisk(e.target.checked)}
                  />
                  <span>
                    I understand this submits a new Pegasus payout and may duplicate funds if the
                    first payout succeeded.
                  </span>
                </label>
                {needsVendorAbsent ? (
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={vendorAbsent}
                      onChange={(e) => setVendorAbsent(e.target.checked)}
                    />
                    <span>
                      I verified with Pegasus that vendor ref{" "}
                      <span className="font-mono text-xs">{vendorRef}</span> does not exist in their
                      system.
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={isRepost ? "destructive" : "default"}
                disabled={!canSubmit}
                onClick={() =>
                  onConfirm({
                    confirmPlatformTransactionId: confirmId.trim(),
                    reason: reason.trim(),
                    acknowledgeDuplicatePayoutRisk: isRepost ? dupRisk : undefined,
                    confirmVendorAbsentOnPegasus: isRepost && needsVendorAbsent ? vendorAbsent : undefined,
                  })
                }
              >
                {loading ? "Working…" : isRepost ? "Confirm repost" : "Confirm poll retry"}
              </Button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function formatLedgerAmount(tx: AdminRemittanceTransactionRow): string {
  const amount = tx.amount_receive ?? tx.amount;
  const cur = tx.currency_receive ?? tx.currency;
  if (amount == null || !cur) return "—";
  return `${amount.toLocaleString()} ${cur}`;
}
