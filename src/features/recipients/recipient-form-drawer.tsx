"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Building2, Loader2, Smartphone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminBankListItem, AdminSavedRecipientRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { normalizePhoneForSave } from "./recipient-utils";

const NETWORKS = ["MTN", "AIRTEL", "Unknown"] as const;

type Mode = "add" | "edit";

export type RecipientFormDrawerProps = {
  open: boolean;
  mode: Mode;
  initial: AdminSavedRecipientRow | null;
  banks: AdminBankListItem[];
  banksLoading: boolean;
  submitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    user_id: string;
    recipient_name: string;
    transfer_type: "mobile_money" | "bank";
    phone_number?: string;
    network?: string;
    bank_name?: string;
    account_number?: string;
    bank_sort_code?: string;
    country_code?: string;
    upsert?: boolean;
  }) => Promise<void>;
  onSubmitEdit?: (id: string, body: Record<string, string | undefined>) => Promise<void>;
};

export function RecipientFormDrawer({
  open,
  mode,
  initial,
  banks,
  banksLoading,
  submitting,
  serverError,
  onClose,
  onSubmit,
  onSubmitEdit,
}: RecipientFormDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [userId, setUserId] = React.useState("");
  const [name, setName] = React.useState("");
  const [transferType, setTransferType] = React.useState<"mobile_money" | "bank">("mobile_money");
  const [phone, setPhone] = React.useState("");
  const [network, setNetwork] = React.useState("");
  const [country, setCountry] = React.useState("UG");
  const [bankCode, setBankCode] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [sortCode, setSortCode] = React.useState("");
  const [localErrors, setLocalErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setUserId(initial.user_id);
      setName(initial.recipient_name);
      setTransferType(initial.transfer_type === "bank" ? "bank" : "mobile_money");
      setPhone(initial.phone_number ?? "");
      setNetwork(initial.network ?? "MTN");
      setCountry(initial.country_code ?? "UG");
      setAccountNumber(initial.account_number ?? "");
      setSortCode(initial.bank_sort_code ?? "");
    } else {
      setUserId("");
      setName("");
      setTransferType("mobile_money");
      setPhone("");
      setNetwork("MTN");
      setCountry("UG");
      setBankCode("");
      setAccountNumber("");
      setSortCode("");
    }
    setLocalErrors([]);
  }, [open, mode, initial?.id]);

  React.useEffect(() => {
    if (!open || mode !== "edit" || !initial || banks.length === 0) return;
    const match = banks.find((b) => b.bankName === initial.bank_name);
    setBankCode(match?.bankCode ?? "");
  }, [open, mode, initial?.id, initial?.bank_name, banks]);

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

  const bankNameResolved = banks.find((b) => b.bankCode === bankCode)?.bankName ?? "";

  const validate = (): boolean => {
    const errs: string[] = [];
    if (mode === "add" && !userId.trim()) errs.push("Customer user ID is required.");
    if (!name.trim()) errs.push("Recipient name is required.");
    if (transferType === "mobile_money") {
      const n = normalizePhoneForSave(phone);
      if (n.length < 9) errs.push("Enter a valid phone number.");
    } else {
      if (!bankCode) errs.push("Select a bank.");
      if (!accountNumber.trim()) errs.push("Account number is required.");
    }
    setLocalErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (mode === "edit" && initial && onSubmitEdit) {
      const body: Record<string, string | undefined> = {
        recipient_name: name.trim(),
        country_code: country.trim().toUpperCase() || undefined,
      };
      if (transferType === "mobile_money") {
        body.phone_number = normalizePhoneForSave(phone);
        body.network = network || undefined;
      } else {
        body.bank_name = bankNameResolved;
        body.account_number = accountNumber.trim();
        body.bank_sort_code = sortCode.trim() || undefined;
      }
      await onSubmitEdit(initial.id, body);
    } else {
      await onSubmit({
        user_id: userId.trim(),
        recipient_name: name.trim(),
        transfer_type: transferType,
        country_code: country.trim().toUpperCase() || undefined,
        ...(transferType === "mobile_money"
          ? {
              phone_number: normalizePhoneForSave(phone),
              network: network || undefined,
            }
          : {
              bank_name: bankNameResolved,
              account_number: accountNumber.trim(),
              bank_sort_code: sortCode.trim() || undefined,
            }),
      });
    }
  };

  const allErrors = [...localErrors, ...(serverError ? [serverError] : [])];

  if (!mounted) return null;

  const panel = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[55] bg-foreground/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[56] flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-[var(--shadow-floating)]"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {mode === "add" ? "Add recipient" : "Edit recipient"}
              </h2>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </Button>
            </header>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {allErrors.length ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    <ul className="list-inside list-disc space-y-0.5">
                      {allErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {mode === "add" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Customer user ID <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="UUID from user_profiles"
                      className="rounded-xl font-mono text-sm"
                      required
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Owner: <span className="font-mono text-foreground">{initial?.user_id}</span>
                  </p>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recipient name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Transfer type
                  </span>
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2 rounded-xl border border-border/80 bg-surface-muted/40 p-1",
                      mode === "edit" && "pointer-events-none opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
                        transferType === "mobile_money"
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted-foreground",
                      )}
                      onClick={() => setTransferType("mobile_money")}
                    >
                      <Smartphone className="size-4" />
                      Mobile money
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
                        transferType === "bank"
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted-foreground",
                      )}
                      onClick={() => setTransferType("bank")}
                    >
                      <Building2 className="size-4" />
                      Bank
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Country
                    </label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="UG"
                      className="rounded-xl font-mono uppercase"
                      maxLength={2}
                    />
                  </div>
                </div>

                {transferType === "mobile_money" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Phone number <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="2567XXXXXXXX"
                        className="rounded-xl font-mono text-sm"
                        inputMode="tel"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Network
                      </label>
                      <select
                        value={network}
                        onChange={(e) => setNetwork(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm"
                      >
                        <option value="">Select network</option>
                        {NETWORKS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Bank <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                        disabled={banksLoading}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm disabled:opacity-60"
                      >
                        <option value="">{banksLoading ? "Loading banks…" : "Select bank"}</option>
                        {banks.map((b) => (
                          <option key={b.bankCode} value={b.bankCode}>
                            {b.bankName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Account number <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="rounded-xl font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Bank sort code
                      </label>
                      <Input
                        value={sortCode}
                        onChange={(e) => setSortCode(e.target.value)}
                        className="rounded-xl font-mono text-sm"
                        placeholder="Optional"
                      />
                    </div>
                  </>
                )}
              </div>

              <footer className="flex gap-3 border-t border-border bg-surface-muted/30 px-5 py-4">
                <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl shadow-sm"
                  disabled={
                    submitting ||
                    !name.trim() ||
                    (mode === "add" && !userId.trim()) ||
                    (transferType === "mobile_money" && normalizePhoneForSave(phone).length < 9) ||
                    (transferType === "bank" && (!bankCode || !accountNumber.trim()))
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : mode === "add" ? (
                    "Create recipient"
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </footer>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}
