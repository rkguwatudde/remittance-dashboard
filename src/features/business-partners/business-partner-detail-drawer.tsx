"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Building2, Loader2, Pencil, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminBusinessPartnerRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function displayName(p: AdminBusinessPartnerRow): string {
  return p.tradingName?.trim() || p.legalName;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/80 py-3 last:border-b-0 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

export type BusinessPartnerDetailDrawerProps = {
  open: boolean;
  partner: AdminBusinessPartnerRow | null;
  savingNotes: boolean;
  notesError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onSaveNotes: (notes: string) => Promise<void>;
};

export function BusinessPartnerDetailDrawer({
  open,
  partner,
  savingNotes,
  notesError,
  onClose,
  onEdit,
  onSaveNotes,
}: BusinessPartnerDetailDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [narration, setNarration] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !partner) return;
    setNarration(partner.notes ?? "");
  }, [open, partner?.id, partner?.notes]);

  React.useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
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

  const notesDirty = partner != null && narration !== (partner.notes ?? "");

  return createPortal(
    <AnimatePresence>
      {open && partner ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-start gap-2">
                <Building2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {displayName(partner)}
                  </h2>
                  {partner.tradingName ? (
                    <p className="truncate text-xs text-muted-foreground">{partner.legalName}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Register businesses and store validated bank accounts for ops payouts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <dl>
                <DetailRow label="Corridor" value={`${partner.countryCode} · ${partner.receiveCurrency}`} />
                <DetailRow label="Contact email" value={partner.contactEmail} />
                <DetailRow label="Contact phone" value={partner.contactPhone} />
                <DetailRow
                  label="Bank"
                  value={
                    partner.bankName
                      ? `${partner.bankName}${partner.bankAccountNumber ? ` · ${partner.bankAccountNumber}` : ""}`
                      : null
                  }
                />
                <DetailRow label="Account name" value={partner.accountHolderName} />
                <DetailRow label="Pegasus MSISDN" value={partner.pegasusSenderMsisdn} />
                <DetailRow
                  label="Validation"
                  value={
                    partner.hasValidatedBank ? (
                      <Badge variant="success">Validated</Badge>
                    ) : partner.bankAccountNumber ? (
                      <Badge variant="warning">Not validated</Badge>
                    ) : (
                      <Badge variant="secondary">No bank</Badge>
                    )
                  }
                />
                {partner.bankValidatedAt ? (
                  <DetailRow
                    label="Validated on"
                    value={format(new Date(partner.bankValidatedAt), "MMM d, yyyy HH:mm")}
                  />
                ) : null}
                {partner.bankValidationReference ? (
                  <DetailRow label="Validation ref" value={partner.bankValidationReference} />
                ) : null}
              </dl>

              <section className="mt-6 space-y-2 border-t border-border pt-5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Narration
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Internal notes for ops — not sent to Pegasus or shown on the partners list.
                </p>
                <textarea
                  className={cn(
                    "min-h-[120px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  )}
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Payment context, contract refs, who to contact…"
                />
                {notesError ? (
                  <p className="text-sm text-danger" role="alert">
                    {notesError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!notesDirty || savingNotes}
                  onClick={() => void onSaveNotes(narration.trim())}
                >
                  {savingNotes ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save narration"
                  )}
                </Button>
              </section>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <Button type="button" variant="outline" className="gap-2" onClick={onEdit}>
                <Pencil className="size-4" />
                Edit profile & bank
              </Button>
              <Link
                href={`/transfer?tab=send&partnerId=${encodeURIComponent(partner.id)}`}
                className={cn(buttonVariants({ variant: "default" }), "gap-2 inline-flex")}
              >
                <Send className="size-4" />
                Send money
              </Link>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
