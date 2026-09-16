"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Building2, CheckCircle2, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminSendMoneyValidateAccount,
  type AdminBankListItem,
  type AdminBusinessPartnerRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit";

export type BusinessPartnerFormDrawerProps = {
  open: boolean;
  mode: Mode;
  initial: AdminBusinessPartnerRow | null;
  banks: AdminBankListItem[];
  banksLoading: boolean;
  accessToken: string | null;
  submitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onCreate: (body: {
    legal_name: string;
    trading_name?: string;
    country_code: string;
    receive_currency: string;
    contact_email?: string;
    contact_phone?: string;
  }) => Promise<AdminBusinessPartnerRow>;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<AdminBusinessPartnerRow>;
};

function partnerDisplayName(p: AdminBusinessPartnerRow): string {
  return p.tradingName?.trim() || p.legalName;
}

export function BusinessPartnerFormDrawer({
  open,
  mode,
  initial,
  banks,
  banksLoading,
  accessToken,
  submitting,
  serverError,
  onClose,
  onCreate,
  onPatch,
}: BusinessPartnerFormDrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const [legalName, setLegalName] = React.useState("");
  const [tradingName, setTradingName] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("UG");
  const [receiveCurrency, setReceiveCurrency] = React.useState("UGX");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [bankSortCode, setBankSortCode] = React.useState("");
  const [accountHolder, setAccountHolder] = React.useState("");
  const [senderMsisdn, setSenderMsisdn] = React.useState("");
  const [validating, setValidating] = React.useState(false);
  const [validateMsg, setValidateMsg] = React.useState<string | null>(null);
  const [validated, setValidated] = React.useState<{
    accountName: string;
    providerReference: string;
  } | null>(null);
  const [localErr, setLocalErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setLegalName(initial.legalName);
      setTradingName(initial.tradingName ?? "");
      setCountryCode(initial.countryCode);
      setReceiveCurrency(initial.receiveCurrency);
      setContactEmail(initial.contactEmail ?? "");
      setContactPhone(initial.contactPhone ?? "");
      setBankAccount(initial.bankAccountNumber ?? "");
      setBankSortCode(initial.bankSortCode ?? "");
      setAccountHolder(initial.accountHolderName ?? initial.bankValidationAccountName ?? "");
      setSenderMsisdn(initial.pegasusSenderMsisdn ?? "");
      setValidated(
        initial.hasValidatedBank
          ? {
              accountName: initial.bankValidationAccountName ?? initial.accountHolderName ?? "",
              providerReference: initial.bankValidationReference ?? "",
            }
          : null,
      );
    } else {
      setLegalName("");
      setTradingName("");
      setCountryCode("UG");
      setReceiveCurrency("UGX");
      setContactEmail("");
      setContactPhone("");
      setBankAccount("");
      setBankSortCode("");
      setAccountHolder("");
      setSenderMsisdn("");
      setValidated(null);
    }
    setValidateMsg(null);
    setLocalErr(null);
  }, [open, mode, initial?.id]);

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

  const onValidateBank = async () => {
    if (!accessToken) {
      setValidateMsg("Sign in to validate.");
      return;
    }
    const acc = bankAccount.trim();
    const code = bankSortCode.trim();
    if (!acc || !code) {
      setValidateMsg("Enter account number and select a bank first.");
      return;
    }
    setValidating(true);
    setValidateMsg(null);
    setValidated(null);
    try {
      const data = await adminSendMoneyValidateAccount(accessToken, {
        payload: {
          type: "bank",
          accountNumber: acc,
          bankCode: code,
          amount: 500,
          currency: receiveCurrency,
        },
      });
      if (data.isProviderSuccess && data.hasUsableRecipientName) {
        setValidated({
          accountName: data.accountName.trim(),
          providerReference: data.providerReference.trim(),
        });
        setAccountHolder(data.accountName.trim());
        setValidateMsg("Account validated with Pegasus.");
      } else {
        setValidateMsg(data.apiMessage || "Validation did not return a usable account name.");
      }
    } catch (e) {
      setValidateMsg(e instanceof AdminApiError ? e.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const onSave = async () => {
    setLocalErr(null);
    const name = legalName.trim();
    if (!name) {
      setLocalErr("Legal name is required.");
      return;
    }

    const bankPayload = {
      bank_account_number: bankAccount.trim() || null,
      bank_sort_code: bankSortCode.trim() || null,
      bank_name: banks.find((b) => b.bankCode === bankSortCode)?.bankName ?? null,
      account_holder_name: accountHolder.trim() || null,
      pegasus_sender_msisdn: senderMsisdn.trim() || null,
      ...(validated
        ? {
            bank_validated_at: new Date().toISOString(),
            bank_validation_reference: validated.providerReference || null,
            bank_validation_account_name: validated.accountName || null,
          }
        : {}),
    };

    try {
      if (mode === "create") {
        const created = await onCreate({
          legal_name: name,
          trading_name: tradingName.trim() || undefined,
          country_code: countryCode,
          receive_currency: receiveCurrency,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
        });
        if (
          bankPayload.bank_account_number &&
          bankPayload.bank_sort_code &&
          created.id
        ) {
          await onPatch(created.id, bankPayload);
        }
      } else if (initial) {
        await onPatch(initial.id, {
          legal_name: name,
          trading_name: tradingName.trim() || null,
          country_code: countryCode,
          receive_currency: receiveCurrency,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          ...bankPayload,
        });
      }
      onClose();
    } catch (e) {
      setLocalErr(e instanceof AdminApiError ? e.message : "Save failed.");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
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
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {mode === "create" ? "Register business partner" : "Edit business partner"}
                  </h2>
                  {mode === "edit" && initial ? (
                    <p className="text-xs text-muted-foreground">{partnerDisplayName(initial)}</p>
                  ) : null}
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

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Business profile
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Legal name *</label>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Trading name (optional)</label>
                  <Input value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Country</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="UG">UG</option>
                      <option value="KE">KE</option>
                      <option value="TZ">TZ</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Receive currency</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      value={receiveCurrency}
                      onChange={(e) => setReceiveCurrency(e.target.value)}
                    >
                      <option value="UGX">UGX</option>
                      <option value="KES">KES</option>
                      <option value="TZS">TZS</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Contact email</label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Contact phone</label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
              </section>

              <section className="space-y-3 border-t border-border pt-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bank account (payout)
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Account number</label>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Bank</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    value={bankSortCode}
                    onChange={(e) => setBankSortCode(e.target.value)}
                    disabled={banksLoading}
                  >
                    <option value="">Select bank…</option>
                    {banks.map((b) => (
                      <option key={`${b.bankCode}-${b.bankName}`} value={b.bankCode}>
                        {b.bankName} ({b.bankCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validating || !accessToken}
                    onClick={() => void onValidateBank()}
                  >
                    {validating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Validating…
                      </>
                    ) : (
                      "Validate with Pegasus"
                    )}
                  </Button>
                </div>
                {validateMsg ? (
                  <p
                    className={cn(
                      "text-xs",
                      validated ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {validateMsg}
                  </p>
                ) : null}
                {validated ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium text-foreground">{validated.accountName}</p>
                      {validated.providerReference ? (
                        <p className="text-muted-foreground">Ref: {validated.providerReference}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Account / business name on bank</label>
                  <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Default Pegasus sender MSISDN (256…)</label>
                  <Input
                    value={senderMsisdn}
                    onChange={(e) => setSenderMsisdn(e.target.value)}
                    placeholder="2567XXXXXXXX"
                  />
                </div>
              </section>

              {localErr || serverError ? (
                <p className="text-sm text-danger" role="alert">
                  {localErr ?? serverError}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={submitting}
                onClick={() => void onSave()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : mode === "create" ? (
                  "Create partner"
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
