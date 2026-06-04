"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  Smartphone,
  Landmark,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminBanksList,
  adminUserDetail,
  adminSendMoneyCustomerRate,
  adminSendMoneyValidateAccount,
  AdminApiError,
  type AdminBankListItem,
  type AdminSendMoneyValidateAccountResponse,
  type AdminUserDetailResponse,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { postRemittancePaymentsViaDashboardProxy } from "@/lib/remittance-payments-api";
import { UserSelector } from "@/features/users/user-selector";

const STEPS = [
  { id: 1, title: "Sender", description: "App user" },
  { id: 2, title: "Amount", description: "USD → receive" },
  { id: 3, title: "Recipient", description: "MM / bank" },
  { id: 4, title: "Review", description: "Submit payment" },
  { id: 5, title: "Result", description: "Queued" },
] as const;

function normalizeMsisdn(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = `256${d.slice(1)}`;
  if (!d.startsWith("256") && d.length === 9) d = `256${d}`;
  return d;
}

function toMinorUnits(currency: string, amount: number): number {
  const c = currency.toUpperCase();
  if (c === "UGX" || c === "KES" || c === "TZS") return Math.round(amount);
  return Math.round(amount * 100);
}

function buildRequestMetadata(): Record<string, unknown> {
  return {
    channel: "ops_dashboard",
    deviceType: "web",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "remittance-dashboard",
    riskScore: 0,
    riskLevel: "LOW",
  };
}

function SendMoneyValidationCard({
  v,
  onApplyName,
  applyLabel,
}: {
  v: AdminSendMoneyValidateAccountResponse;
  onApplyName?: () => void;
  applyLabel: string;
}) {
  const ok = v.isProviderSuccess || v.hasUsableRecipientName;
  const displayName = v.accountName.trim() || "—";
  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4 text-sm",
        ok
          ? "border-emerald-500/45 bg-emerald-500/10 dark:bg-emerald-500/5"
          : "border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/5",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Validation result
      </p>
      <p
        className={cn(
          "text-sm font-medium leading-snug",
          ok ? "text-emerald-800 dark:text-emerald-200" : "text-amber-900 dark:text-amber-100",
        )}
      >
        {v.apiMessage?.trim() || (ok ? "Provider returned account details." : "Review the fields below.")}
      </p>
      {v.apiCode ? (
        <p className="text-[11px] text-muted-foreground">
          API code: <code className="rounded bg-surface-muted px-1">{v.apiCode}</code>
        </p>
      ) : null}
      <dl className="grid gap-3 border-t border-border/60 pt-3 text-xs">
        <div>
          <dt className="font-medium text-muted-foreground">Account / beneficiary name</dt>
          <dd className="mt-0.5 text-base font-semibold text-foreground">{displayName}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Account / phone (ID)</dt>
          <dd className="mt-0.5 font-mono text-sm text-foreground break-all">
            {v.accountNumber.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Network or bank code</dt>
          <dd className="mt-0.5 font-mono text-sm text-foreground">{v.bankCode.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">Provider reference</dt>
          <dd className="mt-0.5 font-mono text-[11px] text-foreground break-all">
            {v.providerReference.trim() || "—"}
          </dd>
        </div>
      </dl>
      {v.hasUsableRecipientName && onApplyName ? (
        <Button type="button" variant="secondary" size="sm" className="mt-1 w-full sm:w-auto" onClick={onApplyName}>
          {applyLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function SendMoneyFlow() {
  const { getAccessToken } = useAuth();
  const adminToken = getAccessToken();

  const [step, setStep] = React.useState(1);
  const [selectedUser, setSelectedUser] = React.useState<AdminUserDirectoryRow | null>(null);
  const [userDetail, setUserDetail] = React.useState<AdminUserDetailResponse | null>(null);
  const [userDetailLoading, setUserDetailLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedUser || !adminToken) {
      setUserDetail(null);
      return;
    }
    let cancelled = false;
    setUserDetailLoading(true);
    adminUserDetail(adminToken, selectedUser.user_id)
      .then((d) => {
        if (!cancelled) setUserDetail(d);
      })
      .catch(() => {
        if (!cancelled) setUserDetail(null);
      })
      .finally(() => {
        if (!cancelled) setUserDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUser, adminToken]);

  const customerGuid = userDetail?.cybrid?.cybrid_customer_id ?? null;

  const [transferType, setTransferType] = React.useState<"mobile_money" | "bank">("mobile_money");
  const [sendUsd, setSendUsd] = React.useState("50");
  const [bondPercent, setBondPercent] = React.useState("0");
  const [receiveCurrency, setReceiveCurrency] = React.useState("UGX");
  const [countryCode, setCountryCode] = React.useState("UG");

  const [customerRate, setCustomerRate] = React.useState<number | null>(null);
  const [rateLoading, setRateLoading] = React.useState(false);
  const [rateError, setRateError] = React.useState<string | null>(null);

  const [receiveAmountLocal, setReceiveAmountLocal] = React.useState<number | null>(null);

  const bondPctNum = Math.min(100, Math.max(0, Number(bondPercent) || 0));
  const sendUsdNum = Number(sendUsd) || 0;
  const useBondRate = bondPctNum > 0;

  const fetchRate = React.useCallback(async () => {
    if (!adminToken || !selectedUser) {
      setRateError("Select a sender and ensure you are signed in.");
      return;
    }
    setRateLoading(true);
    setRateError(null);
    try {
      const data = await adminSendMoneyCustomerRate(adminToken, {
        user_id: selectedUser.user_id,
        useBondRate,
      });
      setCustomerRate(data.customerRate);
      if (sendUsdNum > 0 && data.customerRate > 0) {
        setReceiveAmountLocal(Math.round(sendUsdNum * data.customerRate));
      }
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : "Could not load exchange rate.";
      setRateError(msg);
      setCustomerRate(null);
    } finally {
      setRateLoading(false);
    }
  }, [adminToken, selectedUser, sendUsdNum, useBondRate]);

  React.useEffect(() => {
    if (customerRate != null && customerRate > 0 && sendUsdNum > 0) {
      setReceiveAmountLocal(Math.round(sendUsdNum * customerRate));
    }
  }, [sendUsdNum, customerRate]);

  const [recipientName, setRecipientName] = React.useState("");
  const [mmPhone, setMmPhone] = React.useState("");
  const [mmNetwork, setMmNetwork] = React.useState<"MTN" | "AIRTEL">("MTN");
  const [mmValidation, setMmValidation] = React.useState<
    (AdminSendMoneyValidateAccountResponse & { rail: "mobile_money" }) | null
  >(null);
  const [bankValidation, setBankValidation] = React.useState<
    (AdminSendMoneyValidateAccountResponse & { rail: "bank" }) | null
  >(null);
  const [validating, setValidating] = React.useState(false);

  const [bankAccount, setBankAccount] = React.useState("");
  const [bankHolder, setBankHolder] = React.useState("");
  const [bankSortCode, setBankSortCode] = React.useState("");
  const [senderMsisdn, setSenderMsisdn] = React.useState("");
  const [banks, setBanks] = React.useState<AdminBankListItem[]>([]);

  React.useEffect(() => {
    if (!adminToken || step !== 3 || transferType !== "bank") return;
    let cancelled = false;
    adminBanksList(adminToken)
      .then((b) => {
        if (!cancelled) setBanks(b);
      })
      .catch(() => {
        if (!cancelled) setBanks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [adminToken, step, transferType]);

  const [submitting, setSubmitting] = React.useState(false);
  /** Blocks a second in-flight submit before React re-renders (double-click / rapid taps). */
  const submitInFlightRef = React.useRef(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [paymentResult, setPaymentResult] = React.useState<{
    transactionId: string;
    status: string;
  } | null>(null);

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const canProceed1 =
    Boolean(adminToken) &&
    Boolean(selectedUser) &&
    userDetail?.eligibility.can_transfer === true;

  const minReceive =
    transferType === "bank"
      ? receiveCurrency === "UGX"
        ? 5000
        : 100
      : receiveCurrency === "UGX"
        ? 500
        : 100;

  const canProceed2 =
    sendUsdNum > 0 &&
    customerRate != null &&
    customerRate > 0 &&
    receiveAmountLocal != null &&
    receiveAmountLocal >= minReceive;

  const canProceed3 =
    transferType === "mobile_money"
      ? recipientName.trim().length > 0 && normalizeMsisdn(mmPhone).length >= 12
      : Boolean(bankAccount.trim()) &&
        Boolean(bankSortCode.trim()) &&
        bankHolder.trim().length > 0 &&
        normalizeMsisdn(senderMsisdn).length >= 12;

  const onValidateMm = async () => {
    if (!adminToken || !selectedUser) return;
    setValidating(true);
    setSubmitError(null);
    setMmValidation(null);
    try {
      const phone = normalizeMsisdn(mmPhone);
      const data = await adminSendMoneyValidateAccount(adminToken, {
        user_id: selectedUser.user_id,
        payload: {
          type: "mobile_money",
          phoneNumber: phone,
          network: mmNetwork,
          amount: 500,
          currency: receiveCurrency,
        },
      });
      setMmValidation({ ...data, rail: "mobile_money" });
      if (data.hasUsableRecipientName) {
        setRecipientName(data.accountName.trim());
      }
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : "Validation failed.";
      setSubmitError(msg);
      setMmValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const onValidateBank = async () => {
    if (!adminToken || !selectedUser) return;
    const acc = bankAccount.trim();
    const code = bankSortCode.trim();
    if (!acc || !code) {
      setSubmitError("Enter account number and select a bank before validating.");
      return;
    }
    setValidating(true);
    setSubmitError(null);
    setBankValidation(null);
    try {
      const data = await adminSendMoneyValidateAccount(adminToken, {
        user_id: selectedUser.user_id,
        payload: {
          type: "bank",
          accountNumber: acc,
          bankCode: code,
          amount: 500,
          currency: receiveCurrency,
        },
      });
      setBankValidation({ ...data, rail: "bank" });
      if (data.hasUsableRecipientName) {
        setBankHolder(data.accountName.trim());
      }
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : "Validation failed.";
      setSubmitError(msg);
      setBankValidation(null);
    } finally {
      setValidating(false);
    }
  };

  React.useEffect(() => {
    setMmValidation(null);
  }, [mmPhone, mmNetwork, receiveCurrency]);

  React.useEffect(() => {
    setBankValidation(null);
  }, [bankAccount, bankSortCode, receiveCurrency]);

  const buildDirectPaymentBody = (): Record<string, unknown> => {
    const recv =
      receiveAmountLocal ??
      (customerRate && sendUsdNum > 0 ? Math.round(sendUsdNum * customerRate) : 0);
    const amountMinor = toMinorUnits(receiveCurrency, recv);
    const transferCents = Math.round(sendUsdNum * 100);
    const meta = buildRequestMetadata();

    const base: Record<string, unknown> = {
      transferType,
      paymentType: "payout",
      channel: "web_app",
      amount: amountMinor,
      currency: receiveCurrency.toUpperCase(),
      recipientName: transferType === "bank" ? bankHolder.trim() : recipientName.trim(),
      deviceType: "Web",
      amountSend: transferCents,
      currencySend: "USD",
      amountReceive: recv,
      currencyReceive: receiveCurrency.toUpperCase(),
      metadata: meta,
      riskScore: 0,
      riskLevel: "LOW",
      userAgent: typeof meta.userAgent === "string" ? meta.userAgent : undefined,
    };

    if (customerRate != null && customerRate > 0) {
      base.conversionRate = customerRate;
    }

    if (bondPctNum > 0) {
      base.metadata = { ...meta, bondPercent: bondPctNum };
    }

    const refMm = mmValidation?.providerReference?.trim();
    const refBank = bankValidation?.providerReference?.trim();
    if (transferType === "mobile_money" && refMm) base.referenceId = refMm;
    if (transferType === "bank" && refBank) base.referenceId = refBank;

    if (transferType === "mobile_money") {
      base.phoneNumber = normalizeMsisdn(mmPhone);
      base.network = mmNetwork;
    } else {
      base.phoneNumber = normalizeMsisdn(senderMsisdn);
      base.accountNumber = bankAccount.trim();
      base.bankSortCode = bankSortCode.trim();
    }

    return base;
  };

  const onSubmit = async () => {
    if (!adminToken || !selectedUser) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setPaymentResult(null);
    try {
      const body = buildDirectPaymentBody();
      const queued = await postRemittancePaymentsViaDashboardProxy(
        adminToken,
        selectedUser.user_id,
        body,
      );
      setPaymentResult(queued);
      setStep(5);
    } catch (e) {
      const msg =
        e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : "Submit failed.";
      setSubmitError(msg);
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setPaymentResult(null);
    setSubmitError(null);
    setMmValidation(null);
    setBankValidation(null);
  };

  const blockers = userDetail?.eligibility?.blockers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Send money
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Queues provider payout (Pegasus, ChapChap, etc.) via{" "}
            <code className="rounded bg-surface-muted px-1 text-xs">POST /api/v1/remittance/payments</code>
            , same as the mobile app.             Submit calls the dashboard API, which asks the remittance backend for a short-lived app-user JWT
            (same roles as send-money: Super / Operations / Finance) and then posts to{" "}
            <code className="rounded bg-surface-muted px-1 text-xs">/remittance/payments</code>. No manual
            token config.
          </p>
        </div>
        {step > 1 && step < 5 ? (
          <Button type="button" variant="secondary" className="gap-2" onClick={prevStep}>
            <ChevronLeft className="size-4" />
            Back
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2 px-1 sm:flex-nowrap">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className="flex min-w-[72px] flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  step >= s.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-surface-muted text-muted-foreground",
                )}
              >
                {step > s.id ? <CheckCircle2 className="size-6" /> : s.id}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    step >= s.id ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </p>
              </div>
            </div>
            {idx < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-1 mt-5 hidden h-0.5 min-w-[12px] flex-1 rounded-full sm:block",
                  step > s.id ? "bg-primary" : "bg-surface-muted",
                )}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardContent className="flex min-h-[480px] flex-col p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex flex-1 flex-col gap-6"
              >
                <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>
                      Choose the customer from the directory. On submit, the server mints that user&apos;s
                      access token for the payment call (ops session required).
                    </p>
                  </div>
                </div>

                <UserSelector
                  accessToken={adminToken}
                  selected={selectedUser}
                  onSelect={(u) => {
                    setSelectedUser(u);
                    setListError(null);
                  }}
                  onError={(msg) => setListError(msg)}
                />
                {listError ? (
                  <p className="text-sm text-danger" role="alert">
                    {listError}
                  </p>
                ) : null}

                {userDetailLoading ? (
                  <p className="text-sm text-muted-foreground">Loading sender profile…</p>
                ) : userDetail ? (
                  <div className="space-y-2 rounded-xl border border-border bg-surface-muted/30 p-4 text-sm">
                    <p>
                      <span className="text-muted-foreground">Cybrid customer</span>{" "}
                      <span className="font-mono text-foreground">
                        {customerGuid ?? "— not linked —"}
                      </span>
                    </p>
                    {!userDetail.eligibility.can_transfer && blockers.length > 0 ? (
                      <ul className="list-inside list-disc text-danger">
                        {blockers.map((b) => (
                          <li key={b.code}>
                            {b.message}{" "}
                            <span className="text-xs opacity-80">({b.code})</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : selectedUser ? (
                  <p className="text-sm text-danger">Could not load user detail.</p>
                ) : null}

                <div className="mt-auto pt-4">
                  <Button
                    type="button"
                    className="h-12 w-full gap-2"
                    disabled={!canProceed1}
                    onClick={nextStep}
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex flex-1 flex-col gap-6"
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferType("mobile_money")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold transition",
                      transferType === "mobile_money"
                        ? "border-primary bg-primary-muted/40 text-primary"
                        : "border-border bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <Smartphone className="size-5" />
                    Mobile money
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType("bank")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold transition",
                      transferType === "bank"
                        ? "border-primary bg-primary-muted/40 text-primary"
                        : "border-border bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <Landmark className="size-5" />
                    Bank
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">You send (USD)</label>
                    <Input
                      inputMode="decimal"
                      value={sendUsd}
                      onChange={(e) => setSendUsd(e.target.value)}
                      placeholder="50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Bond % (0–100)</label>
                    <Input
                      inputMode="numeric"
                      value={bondPercent}
                      onChange={(e) => setBondPercent(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Receive currency</label>
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
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Country</label>
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
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={rateLoading || !adminToken || !selectedUser}
                    onClick={() => void fetchRate()}
                    className="gap-2"
                  >
                    {rateLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading rate…
                      </>
                    ) : (
                      "Fetch customer rate"
                    )}
                  </Button>
                  {useBondRate ? (
                    <span className="text-xs text-muted-foreground">Using bond tier rate.</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Using standard tier rate.</span>
                  )}
                </div>
                {rateError ? (
                  <p className="text-sm text-danger" role="alert">
                    {rateError}
                  </p>
                ) : null}

                <div className="rounded-xl border border-border bg-surface-muted/40 p-4 text-sm">
                  <p className="text-muted-foreground">Recipient gets (approx.)</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {receiveAmountLocal != null
                      ? `${receiveAmountLocal.toLocaleString()} ${receiveCurrency}`
                      : "—"}
                  </p>
                  {customerRate != null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rate: 1 USD → {customerRate} {receiveCurrency}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Minimum receive: {minReceive} {receiveCurrency}{" "}
                    {transferType === "bank" ? "(bank)" : "(mobile)"}.
                  </p>
                </div>

                <Button
                  type="button"
                  className="mt-auto h-12 w-full gap-2"
                  disabled={!canProceed2}
                  onClick={nextStep}
                >
                  Recipient details
                  <ArrowRight className="size-4" />
                </Button>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex flex-1 flex-col gap-5"
              >
                {transferType === "mobile_money" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Phone (256…)</label>
                        <Input
                          value={mmPhone}
                          onChange={(e) => setMmPhone(e.target.value)}
                          placeholder="2567XXXXXXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Network</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                          value={mmNetwork}
                          onChange={(e) =>
                            setMmNetwork(e.target.value as "MTN" | "AIRTEL")
                          }
                        >
                          <option value="MTN">MTN</option>
                          <option value="AIRTEL">AIRTEL</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={validating || !adminToken || !selectedUser}
                        onClick={() => void onValidateMm()}
                      >
                        {validating ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Validating…
                          </>
                        ) : (
                          "Validate account (optional)"
                        )}
                      </Button>
                    </div>
                    {mmValidation ? (
                      <SendMoneyValidationCard
                        v={mmValidation}
                        applyLabel="Copy validated name into beneficiary field"
                        onApplyName={() => setRecipientName(mmValidation.accountName.trim())}
                      />
                    ) : null}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Recipient name (beneficiary)
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Filled automatically when the provider returns a registered name. You can edit
                        before sending.
                      </p>
                      <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Account number</label>
                      <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Bank</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        value={bankSortCode}
                        onChange={(e) => setBankSortCode(e.target.value)}
                      >
                        <option value="">Select bank…</option>
                        {banks.map((b) => (
                          <option key={`${b.bankCode}-${b.bankName}`} value={b.bankCode}>
                            {b.bankName} ({b.bankCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={validating || !adminToken || !selectedUser}
                        onClick={() => void onValidateBank()}
                      >
                        {validating ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Validating…
                          </>
                        ) : (
                          "Validate account (optional)"
                        )}
                      </Button>
                    </div>
                    {bankValidation ? (
                      <SendMoneyValidationCard
                        v={bankValidation}
                        applyLabel="Copy validated name into account holder"
                        onApplyName={() => setBankHolder(bankValidation.accountName.trim())}
                      />
                    ) : null}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Account holder</label>
                      <p className="text-[11px] text-muted-foreground">
                        Pre-filled from validation when the bank returns an account name.
                      </p>
                      <Input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Sender phone (256…) — Pegasus msisdn
                      </label>
                      <Input
                        value={senderMsisdn}
                        onChange={(e) => setSenderMsisdn(e.target.value)}
                        placeholder="2567XXXXXXXX"
                      />
                    </div>
                  </>
                )}

                {submitError && step === 3 ? (
                  <p className="text-sm text-danger" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <Button
                  type="button"
                  className="mt-auto h-12 w-full gap-2"
                  disabled={!canProceed3}
                  onClick={nextStep}
                >
                  Review
                  <ArrowRight className="size-4" />
                </Button>
              </motion.div>
            ) : null}

            {step === 4 ? (
              <motion.div
                key="s4"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex flex-1 flex-col gap-6"
              >
                <div className="space-y-3 rounded-xl border border-border bg-surface-muted/50 p-5 text-sm">
                  <Row k="Sender user" v={selectedUser?.user_id ?? "—"} />
                  <Row k="Rail" v={transferType === "mobile_money" ? "Mobile money" : "Bank"} />
                  <Row k="Debit (USD)" v={`${sendUsdNum.toFixed(2)} USD`} />
                  <Row
                    k="Credit"
                    v={
                      receiveAmountLocal != null
                        ? `${receiveAmountLocal.toLocaleString()} ${receiveCurrency}`
                        : "—"
                    }
                  />
                  <Row
                    k="Recipient"
                    v={
                      transferType === "bank"
                        ? bankHolder.trim() || "—"
                        : recipientName.trim() || "—"
                    }
                  />
                  {transferType === "mobile_money" ? (
                    <Row
                      k="Phone / network"
                      v={`${normalizeMsisdn(mmPhone)} · ${mmNetwork}`}
                    />
                  ) : (
                    <>
                      <Row k="Account" v={bankAccount.trim()} />
                      <Row k="Bank sort code" v={bankSortCode.trim()} />
                      <Row k="Sender msisdn" v={normalizeMsisdn(senderMsisdn)} />
                    </>
                  )}
                </div>

                {submitError ? (
                  <div className="rounded-xl border border-danger/40 bg-danger-muted/30 px-4 py-3 text-sm text-danger whitespace-pre-line">
                    {submitError}
                  </div>
                ) : null}

                <Button
                  type="button"
                  className="h-12 w-full gap-2"
                  disabled={submitting || !adminToken || !selectedUser}
                  onClick={() => void onSubmit()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Submitting payment…
                    </>
                  ) : (
                    <>
                      Send payment
                      <ArrowRight className="size-5" />
                    </>
                  )}
                </Button>
              </motion.div>
            ) : null}

            {step === 5 ? (
              <motion.div
                key="s5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
              >
                <div className="flex size-20 items-center justify-center rounded-full bg-success-muted text-success">
                  <CheckCircle2 className="size-10" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Payment queued</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Provider processing was enqueued (same path as the mobile app). Final status appears in
                    transactions and the work queue.
                  </p>
                  {paymentResult?.transactionId ? (
                    <p className="mt-3 font-mono text-sm text-foreground break-all">
                      {paymentResult.transactionId}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">—</p>
                  )}
                  {paymentResult?.status ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: <span className="font-medium text-foreground">{paymentResult.status}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex w-full max-w-sm flex-col gap-2 pt-4">
                  <Link
                    href="/transactions"
                    className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
                  >
                    Open transactions
                  </Link>
                  <Link
                    href="/queue"
                    className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
                  >
                    Open queue
                  </Link>
                  <Button type="button" className="h-11 w-full" onClick={resetFlow}>
                    New send
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[60%] text-right font-medium text-foreground break-all">{v}</span>
    </div>
  );
}
