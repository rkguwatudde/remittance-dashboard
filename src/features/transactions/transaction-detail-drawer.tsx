"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { CreditCard, Landmark, Loader2, RotateCcw, Send, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import {
  AdminApiError,
  adminRepostPegasusPayout,
  adminRetryPegasusPayout,
  type AdminRemittanceTransactionRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { isPegasusInvalidTransactionPollFailure } from "./pegasus-retry.util";
import type { PegasusRecoveryAction } from "./pegasus-recovery-dialog";

import {
  fundingBadgeVariant,
  resolveFundingLegs,
  resolveFundingView,
  type FundingKind,
  type FundingLegView,
} from "./funding-presentation";

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

function formatLedgerAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || !currency?.trim()) return "—";
  const code = currency.trim().toUpperCase();
  const zeroFraction = code === "UGX" || code === "KES" || code === "TZS";
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: zeroFraction ? 0 : 2,
    minimumFractionDigits: 0,
  })} ${code}`;
}

function feeSummary(tx: AdminRemittanceTransactionRow): string {
  const feeLabel =
    tx.fee_basis_points != null ? `${(tx.fee_basis_points / 100).toFixed(2)}%` : null;
  const charges = tx.fee_charges != null ? `$${tx.fee_charges}` : null;
  return [feeLabel, charges].filter(Boolean).join(" · ") || "—";
}

function FundingIcon({ kind }: { kind: FundingKind }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (kind === "card") return <CreditCard className={className} aria-hidden />;
  if (kind === "wallet") return <Wallet className={className} aria-hidden />;
  if (kind === "ops") return <Send className={className} aria-hidden />;
  return <Landmark className={className} aria-hidden />;
}

function FundingPanel({
  leg,
}: {
  leg: FundingLegView;
}) {
  const title = leg.role === "bond" ? "Bond allocation" : "Remittance";
  const methodBadge =
    leg.kind === "cybrid_bank" ? "Bank/ACH" : leg.kind === "card" ? "Card" : leg.label;
  const guid = leg.kind === "cybrid_bank" ? leg.cybridGuid : null;
  const cardId = leg.kind === "card" ? leg.cardId : null;

  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-border bg-surface">
          <FundingIcon kind={leg.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{leg.label}</p>
            <Badge variant={fundingBadgeVariant(leg.kind)} className="capitalize">
              {methodBadge}
            </Badge>
            {leg.status ? (
              <Badge variant={statusBadgeVariant(leg.status)} className="capitalize">
                {leg.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
          {leg.amountUsd != null ? (
            <p className="mt-0.5 text-sm text-foreground">
              ${leg.amountUsd.toFixed(2)}
            </p>
          ) : null}
          {leg.railLabel ? (
            <p className="mt-0.5 text-sm text-foreground">{leg.railLabel}</p>
          ) : null}
          {leg.instrument ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{leg.instrument}</p>
          ) : null}
          {leg.role === "remittance" && leg.decisionLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">{leg.decisionLabel}</p>
          ) : null}
          {guid ? (
            <p className="mt-2 font-mono text-[11px] break-all text-muted-foreground">
              Cybrid transfer {guid}
            </p>
          ) : null}
          {leg.providerReference && leg.providerReference !== guid ? (
            <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
              Reference {leg.providerReference}
            </p>
          ) : null}
          {leg.paymentTransferId ? (
            <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
              Payment transfer {leg.paymentTransferId}
            </p>
          ) : null}
          {cardId ? (
            <p className="mt-2 font-mono text-[11px] break-all text-muted-foreground">
              Card {cardId}
            </p>
          ) : null}
          {leg.failureReason ? (
            <p className="mt-2 text-xs text-destructive">{leg.failureReason}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type TransactionDetailDrawerProps = {
  open: boolean;
  transaction: AdminRemittanceTransactionRow | null;
  onClose: () => void;
  onFullyClosed?: () => void;
  onTransactionUpdated?: (transaction: AdminRemittanceTransactionRow) => void;
};

export function TransactionDetailDrawer({
  open,
  transaction,
  onClose,
  onFullyClosed,
  onTransactionUpdated,
}: TransactionDetailDrawerProps) {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const [retryBusy, setRetryBusy] = React.useState(false);
  const [repostBusy, setRepostBusy] = React.useState(false);
  const [retryMessage, setRetryMessage] = React.useState<string | null>(null);
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const [confirmPlatformTxId, setConfirmPlatformTxId] = React.useState("");
  const [recoveryReason, setRecoveryReason] = React.useState("");
  const [repostDupAck, setRepostDupAck] = React.useState(false);
  const [repostVendorAbsent, setRepostVendorAbsent] = React.useState(false);

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

  React.useEffect(() => {
    if (!open) {
      setRetryBusy(false);
      setRepostBusy(false);
      setRetryMessage(null);
      setRetryError(null);
      setConfirmPlatformTxId("");
      setRecoveryReason("");
      setRepostDupAck(false);
      setRepostVendorAbsent(false);
    }
  }, [open, displayTx?.id]);

  if (!mounted || !displayTx) return null;

  const showPegasusRetry =
    isSuperAdmin && isPegasusInvalidTransactionPollFailure(displayTx);

  const pegasusRecovery = displayTx.pegasus_recovery ?? null;
  const eligibilityPending = showPegasusRetry && pegasusRecovery == null;
  const pollAllowed = pegasusRecovery?.pollRetryEligible === true;
  const repostAllowed = pegasusRecovery?.repostEligible === true;

  const lookupId =
    displayTx.platform_transaction_id?.trim() ||
    displayTx.transaction_ref?.trim() ||
    displayTx.id;

  const platformTxForConfirm = displayTx.platform_transaction_id?.trim() ?? "";
  const needsVendorAbsentConfirm =
    pegasusRecovery?.repostRequiresVendorAbsentConfirmation === true;
  const confirmIdOk =
    confirmPlatformTxId.trim().toUpperCase() === platformTxForConfirm.toUpperCase();
  const reasonOk = recoveryReason.trim().length >= 10;
  const repostChecksOk = repostDupAck && (!needsVendorAbsentConfirm || repostVendorAbsent);

  const runPegasusRecovery = async (action: PegasusRecoveryAction) => {
    if (!confirmIdOk) {
      setRetryError(`Type Platform Tx ID exactly: ${platformTxForConfirm}`);
      return;
    }
    if (!reasonOk) {
      setRetryError("Reason must be at least 10 characters (ticket / Pegasus verification).");
      return;
    }
    if (action === "repost" && !repostChecksOk) {
      setRetryError("Complete the repost checkboxes before submitting.");
      return;
    }

    const setBusy = action === "repost" ? setRepostBusy : setRetryBusy;
    setBusy(true);
    setRetryError(null);
    setRetryMessage(null);
    try {
      let token = getAccessToken();
      if (!token) {
        const ok = await refreshAccessToken();
        if (ok) token = getAccessToken();
      }
      if (!token) {
        setRetryError("Sign in again to run Pegasus recovery.");
        return;
      }

      if (action === "poll_retry") {
        const result = await adminRetryPegasusPayout(token, lookupId, {
          confirm_platform_transaction_id: confirmPlatformTxId.trim(),
          reason: recoveryReason.trim(),
        });
        if (result.transaction) {
          holdRef.current = result.transaction;
          onTransactionUpdated?.(result.transaction);
          const st = result.transaction.status.toUpperCase();
          if (st === "SUCCESS") {
            setRetryMessage("Pegasus confirmed success — transfer updated.");
          } else if (st === "PENDING_PROVIDER") {
            setRetryMessage("Re-polling Pegasus — status is pending provider.");
          } else {
            setRetryMessage(
              result.payout.failureReason?.trim() ||
                `Payout status: ${result.payout.status ?? "unknown"}`,
            );
          }
        } else {
          setRetryMessage("Retry submitted — refresh the list if status does not update.");
        }
      } else {
        const result = await adminRepostPegasusPayout(token, lookupId, {
          confirm_platform_transaction_id: confirmPlatformTxId.trim(),
          reason: recoveryReason.trim(),
          acknowledge_duplicate_payout_risk: repostDupAck,
          confirm_vendor_absent_on_pegasus: needsVendorAbsentConfirm
            ? repostVendorAbsent
            : undefined,
        });
        if (result.transaction) {
          holdRef.current = result.transaction;
          onTransactionUpdated?.(result.transaction);
          const st = result.transaction.status.toUpperCase();
          if (st === "SUCCESS") {
            setRetryMessage("New Pegasus payout completed — transfer marked success.");
          } else if (st === "PENDING_PROVIDER") {
            setRetryMessage(
              `PostTransaction submitted. New vendor ref: ${result.transaction.provider_reference ?? "see provider reference"}.`,
            );
          } else if (st === "FAILED") {
            setRetryError(result.transaction.error_message ?? "Repost failed at Pegasus.");
          } else {
            setRetryMessage(`Transfer status: ${result.transaction.status}`);
          }
        }
      }
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        await refreshAccessToken();
      }
      setRetryError(
        e instanceof AdminApiError ? e.message : "Pegasus recovery action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const feesDisplay = feeSummary(displayTx);
  const funding = resolveFundingView(displayTx);
  const fundingLegs = resolveFundingLegs(displayTx);

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
              {displayTx.recipient_entity_type === "business" ? (
                <Badge variant="secondary">Business partner</Badge>
              ) : null}
              {fundingLegs.length > 1 ? (
                <Badge variant="outline">Split funding</Badge>
              ) : funding.kind !== "unknown" ? (
                <Badge variant={fundingBadgeVariant(funding.kind)}>
                  {funding.railLabel ? `${funding.label} · ${funding.railLabel}` : funding.label}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {format(new Date(displayTx.created_at), "MMM d, yyyy · HH:mm:ss")}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {showPegasusRetry ? (
                <div className="mb-3 rounded-xl border border-warning/40 bg-warning-muted/20 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Pegasus recovery</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Platform Tx ID</span> (BBT…) is
                    internal only. Pegasus uses{" "}
                    <span className="font-medium text-foreground">Provider reference</span> for
                    GetTransactionDetails. Status code 16 /{" "}
                    <span className="font-medium text-foreground">INVALID TRANSACTION DETAILS</span>{" "}
                    usually means that vendor id was never indexed — repost if Pegasus confirms it
                    is missing.
                  </p>
                  {retryError ? (
                    <p className="mt-2 text-xs text-destructive">{retryError}</p>
                  ) : null}
                  {retryMessage ? (
                    <p className="mt-2 text-xs text-success">{retryMessage}</p>
                  ) : null}
                  {eligibilityPending ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Loading Pegasus eligibility from payment-service…
                    </p>
                  ) : null}
                  {pegasusRecovery?.pollRetryBlockedReason && !pollAllowed ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Poll disabled: {pegasusRecovery.pollRetryBlockedReason}
                    </p>
                  ) : null}
                  {pegasusRecovery?.repostBlockedReason && !repostAllowed ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Repost disabled: {pegasusRecovery.repostBlockedReason}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-surface/80 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Required confirmation
                    </p>
                    <Input
                      className="font-mono text-sm"
                      placeholder={`Type ${platformTxForConfirm} to confirm`}
                      value={confirmPlatformTxId}
                      onChange={(e) => setConfirmPlatformTxId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Input
                      className="text-sm"
                      placeholder="Reason / ticket (min 10 characters)"
                      value={recoveryReason}
                      onChange={(e) => setRecoveryReason(e.target.value)}
                    />
                    <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={repostDupAck}
                        onChange={(e) => setRepostDupAck(e.target.checked)}
                      />
                      <span>
                        Repost only: I understand a new PostTransaction may duplicate payout if
                        the first succeeded.
                      </span>
                    </label>
                    {needsVendorAbsentConfirm ? (
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={repostVendorAbsent}
                          onChange={(e) => setRepostVendorAbsent(e.target.checked)}
                        />
                        <span>
                          Repost only: Pegasus confirmed the prior vendor reference does not exist.
                        </span>
                      </label>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        eligibilityPending ||
                        !repostAllowed ||
                        repostBusy ||
                        retryBusy ||
                        !confirmIdOk ||
                        !reasonOk ||
                        !repostChecksOk
                      }
                      onClick={() => void runPegasusRecovery("repost")}
                    >
                      {repostBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Post again to Pegasus
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        eligibilityPending ||
                        !pollAllowed ||
                        retryBusy ||
                        repostBusy ||
                        !confirmIdOk ||
                        !reasonOk
                      }
                      onClick={() => void runPegasusRecovery("poll_retry")}
                    >
                      {retryBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Poll existing vendor ref
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="mb-2 flex flex-col gap-2">
                {fundingLegs.map((leg) => (
                  <FundingPanel key={`${leg.role}-${leg.paymentTransferId ?? leg.kind}`} leg={leg} />
                ))}
              </div>
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
                    displayTx.amount_receive != null && displayTx.currency_receive
                      ? formatLedgerAmount(displayTx.amount_receive, displayTx.currency_receive)
                      : formatLedgerAmount(displayTx.amount, displayTx.currency)
                  }
                />
                <DetailItem
                  label="Send / receive"
                  value={
                    displayTx.amount_send != null || displayTx.amount_receive != null
                      ? [
                          displayTx.amount_send != null &&
                            formatLedgerAmount(displayTx.amount_send, displayTx.currency_send),
                          displayTx.amount_receive != null &&
                            formatLedgerAmount(
                              displayTx.amount_receive,
                              displayTx.currency_receive,
                            ),
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
                  label="Payout provider status"
                  value={displayTx.payout_provider_status ?? "—"}
                />
                <DetailItem label="Provider reference" value={displayTx.provider_reference} mono />
                <DetailItem label="Recipient phone" value={displayTx.phone_number} mono />
                <DetailItem label="Bank account" value={displayTx.account_number} mono />
                <DetailItem label="Bank sort code" value={displayTx.bank_sort_code} mono />
                <DetailItem
                  label={
                    displayTx.recipient_entity_type === "business"
                      ? "Business name"
                      : "Recipient name"
                  }
                  value={displayTx.recipient_name}
                />
                <DetailItem label="Narration" value={displayTx.narration} />
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
