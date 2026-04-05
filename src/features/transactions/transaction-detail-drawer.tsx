"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminRemittanceTransactionRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function statusBadgeVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "success";
  if (s === "FAILED" || s === "TIMEOUT") return "destructive";
  if (s === "QUEUED" || s === "INITIATED" || s === "PROCESSING" || s === "PENDING_PROVIDER") {
    return "warning";
  }
  return "secondary";
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border/80 py-3 last:border-b-0 sm:grid-cols-[minmax(0,160px)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", mono && "font-mono text-[13px] break-all")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function feeSummary(tx: AdminRemittanceTransactionRow): string {
  const feeLabel =
    tx.fee_basis_points != null ? `${(tx.fee_basis_points / 100).toFixed(2)}%` : null;
  const charges = tx.fee_charges != null ? `$${tx.fee_charges}` : null;
  return [feeLabel, charges].filter(Boolean).join(" · ") || "—";
}

type TransactionDetailDrawerProps = {
  open: boolean;
  transaction: AdminRemittanceTransactionRow | null;
  onClose: () => void;
  onFullyClosed?: () => void;
};

export function TransactionDetailDrawer({
  open,
  transaction,
  onClose,
  onFullyClosed,
}: TransactionDetailDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const openRef = React.useRef(open);
  openRef.current = open;
  const holdRef = React.useRef<AdminRemittanceTransactionRow | null>(null);
  if (transaction) holdRef.current = transaction;
  const displayTx = transaction ?? holdRef.current;

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !displayTx) return null;

  const feesDisplay = feeSummary(displayTx);

  const content = (
    <AnimatePresence
      onExitComplete={() => {
        if (!openRef.current) {
          holdRef.current = null;
          onFullyClosed?.();
        }
      }}
    >
      {open ? (
        <>
          <motion.button
            key="tx-drawer-backdrop"
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
            key={`tx-drawer-panel-${displayTx.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-drawer-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p
                  id="tx-drawer-title"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Transaction
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {displayTx.id}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
              <Badge variant={statusBadgeVariant(displayTx.status)} className="capitalize">
                {displayTx.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(displayTx.created_at), "MMM d, yyyy · HH:mm:ss")}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <dl>
                <DetailItem label="Customer email" value={displayTx.customer_email} />
                <DetailItem label="Platform Tx ID" value={displayTx.platform_transaction_id} mono />
                <DetailItem label="Transaction ref" value={displayTx.transaction_ref} mono />
                <DetailItem label="Provider" value={displayTx.provider} />
                <DetailItem label="Transfer type" value={displayTx.transfer_type} />
                <DetailItem label="Payment type" value={displayTx.payment_type} />
                <DetailItem
                  label="Remittance amount"
                  value={
                    displayTx.amount != null
                      ? `${displayTx.amount.toLocaleString()} ${displayTx.currency}`
                      : "—"
                  }
                />
                <DetailItem
                  label="Send / receive"
                  value={
                    displayTx.amount_send != null || displayTx.amount_receive != null
                      ? [
                          displayTx.amount_send != null &&
                            `${displayTx.amount_send} ${displayTx.currency_send ?? ""}`,
                          displayTx.amount_receive != null &&
                            `${displayTx.amount_receive} ${displayTx.currency_receive ?? ""}`,
                        ]
                          .filter(Boolean)
                          .join(" → ")
                      : "—"
                  }
                />
                <DetailItem
                  label="Bond (USD est.)"
                  value={
                    displayTx.bond_amount_usd != null
                      ? `$${displayTx.bond_amount_usd.toFixed(2)}`
                      : "—"
                  }
                />
                <DetailItem label="Fees (spread / charge)" value={feesDisplay} />
                <DetailItem
                  label="Cybrid status"
                  value={displayTx.cybrid_transaction_status ?? "—"}
                />
                <DetailItem
                  label="Payout provider status"
                  value={displayTx.payout_provider_status ?? "—"}
                />
                <DetailItem label="Provider reference" value={displayTx.provider_reference} mono />
                <DetailItem label="Recipient phone" value={displayTx.phone_number} mono />
                <DetailItem label="Bank account" value={displayTx.account_number} mono />
                <DetailItem label="Bank sort code" value={displayTx.bank_sort_code} mono />
                <DetailItem label="Recipient name" value={displayTx.recipient_name} />
                <DetailItem label="Narration" value={displayTx.narration} />
                <DetailItem
                  label="Cybrid funding GUID"
                  value={displayTx.cybrid_funding_transfer_guid}
                  mono
                />
                <DetailItem
                  label="Updated"
                  value={format(new Date(displayTx.updated_at), "MMM d, yyyy HH:mm:ss")}
                />
                <DetailItem label="Error" value={displayTx.error_message} />
              </dl>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
