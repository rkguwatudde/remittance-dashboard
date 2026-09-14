"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Info,
  Landmark,
  Loader2,
  Smartphone,
  UserRound,
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
  adminSendMoneyBusinessRate,
  adminSendMoneyCustomerRate,
  adminSendMoneyValidateAccount,
  adminSendMoneyOtpChallenge,
  adminSendMoneyOtpVerify,
  AdminApiError,
  type AdminBankListItem,
  type AdminSendMoneyValidateAccountResponse,
  type AdminUserDetailResponse,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { postRemittancePaymentsViaDashboardProxy } from "@/lib/remittance-payments-api";
import { UserSelector } from "@/features/users/user-selector";
import { CustomerSegmentBadge, DeviceBadge, PresenceIndicator, ProductBadge } from "@/features/users/user-badges";
import { SendMoneyOtpDialog } from "./send-money-otp-dialog";
import {
  lockedReceiveMajor,
  parseLocalReceiveInput,
  sendUsdFromReceiveMajor,
} from "./send-money-amount";

type AmountEntryMode = "send_usd" | "receive_local";

const STEPS = [
  { id: 1, title: "Sender", description: "App user" },
  { id: 2, title: "Amount", description: "USD → receive" },
  { id: 3, title: "Recipient", description: "Person / business" },
  { id: 4, title: "Review", description: "Confirm" },
  { id: 5, title: "Result", description: "Queued" },
] as const;

type RecipientKind = "person" | "business";

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

function newSendMoneyIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ops-send-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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

  const [recipientKind, setRecipientKind] = React.useState<RecipientKind>("person");
  const [transferType, setTransferType] = React.useState<"mobile_money" | "bank">("mobile_money");
  const isBusinessPayee = recipientKind === "business";
  const payoutRail: "mobile_money" | "bank" = isBusinessPayee ? "bank" : transferType;
  const [sendUsd, setSendUsd] = React.useState("50");
  /** Business payouts only: enter USD or local receive amount (UGX/KES/TZS). */
  const [amountEntryMode, setAmountEntryMode] = React.useState<AmountEntryMode>("send_usd");
  const [receiveInput, setReceiveInput] = React.useState("");
  const [bondPercent, setBondPercent] = React.useState("0");
  const [receiveCurrency, setReceiveCurrency] = React.useState("UGX");
  const [countryCode, setCountryCode] = React.useState("UG");

  const [customerRate, setCustomerRate] = React.useState<number | null>(null);
  const [rateLoading, setRateLoading] = React.useState(false);
  const [rateError, setRateError] = React.useState<string | null>(null);

  const [receiveAmountLocal, setReceiveAmountLocal] = React.useState<number | null>(null);

  const sendOnlyCustomer =
    selectedUser?.product_intent === "send_only" ||
    selectedUser?.account_purpose === "SEND_MONEY_ONLY" ||
    userDetail?.profile.product_intent === "send_only" ||
    userDetail?.profile.account_purpose === "SEND_MONEY_ONLY";

  const bondPctNum = sendOnlyCustomer
    ? 0
    : Math.min(100, Math.max(0, Number(bondPercent) || 0));
  const sendUsdNum = Number(sendUsd) || 0;
  const receiveInputNum = parseLocalReceiveInput(receiveInput);
  const useBondRate = bondPctNum > 0;
  const businessEnteringReceive =
    isBusinessPayee && amountEntryMode === "receive_local";

  const fetchRate = React.useCallback(async () => {
    if (!adminToken) {
      setRateError("Sign in to load a rate.");
      return;
    }
    if (!isBusinessPayee && !selectedUser) {
      setRateError("Select a sender and ensure you are signed in.");
      return;
    }
    setRateLoading(true);
    setRateError(null);
    try {
      if (isBusinessPayee) {
        const data = await adminSendMoneyBusinessRate(adminToken, {
          receive_currency: receiveCurrency,
          send_currency: "USD",
        });
        setCustomerRate(data.businessRate);
        if (data.businessRate > 0) {
          if (amountEntryMode === "receive_local" && receiveInputNum > 0) {
            const usd = sendUsdFromReceiveMajor(receiveInputNum, data.businessRate);
            setSendUsd(usd > 0 ? usd.toFixed(2) : "0");
            setReceiveAmountLocal(
              usd > 0 ? lockedReceiveMajor(usd, data.businessRate) : null,
            );
          } else if (sendUsdNum > 0) {
            setReceiveAmountLocal(lockedReceiveMajor(sendUsdNum, data.businessRate));
          }
        }
        return;
      }
      if (!selectedUser) {
        setRateError("Select a sender and ensure you are signed in.");
        return;
      }
      const data = await adminSendMoneyCustomerRate(adminToken, {
        user_id: selectedUser.user_id,
        useBondRate,
      });
      setCustomerRate(data.customerRate);
      if (sendUsdNum > 0 && data.customerRate > 0) {
        setReceiveAmountLocal(lockedReceiveMajor(sendUsdNum, data.customerRate));
      }
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : "Could not load exchange rate.";
      setRateError(msg);
      setCustomerRate(null);
    } finally {
      setRateLoading(false);
    }
  }, [
    adminToken,
    selectedUser,
    sendUsdNum,
    receiveInputNum,
    amountEntryMode,
    useBondRate,
    isBusinessPayee,
    receiveCurrency,
  ]);

  React.useEffect(() => {
    if (customerRate == null || customerRate <= 0) return;
    if (businessEnteringReceive) {
      if (receiveInputNum <= 0) {
        setReceiveAmountLocal(null);
        return;
      }
      const usd = sendUsdFromReceiveMajor(receiveInputNum, customerRate);
      if (usd > 0) {
        setSendUsd(usd.toFixed(2));
        setReceiveAmountLocal(lockedReceiveMajor(usd, customerRate));
      }
      return;
    }
    if (sendUsdNum > 0) {
      setReceiveAmountLocal(lockedReceiveMajor(sendUsdNum, customerRate));
    }
  }, [
    sendUsdNum,
    receiveInputNum,
    customerRate,
    businessEnteringReceive,
  ]);

  React.useEffect(() => {
    if (!isBusinessPayee) return;
    setCustomerRate(null);
    setReceiveAmountLocal(null);
    setReceiveInput("");
    setRateError(null);
  }, [receiveCurrency, isBusinessPayee]);

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
  const selectedBank = banks.find((b) => b.bankCode === bankSortCode.trim());

  React.useEffect(() => {
    const phone = userDetail?.profile.phone ?? selectedUser?.phone;
    if (!phone) return;
    setSenderMsisdn((current) => (current.trim() ? current : normalizeMsisdn(phone)));
  }, [userDetail?.profile.phone, selectedUser?.phone]);

  React.useEffect(() => {
    if (!adminToken || step !== 3 || payoutRail !== "bank") return;
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
  }, [adminToken, step, payoutRail]);

  const [submitting, setSubmitting] = React.useState(false);
  /** Blocks a second in-flight submit before React re-renders (double-click / rapid taps). */
  const submitInFlightRef = React.useRef(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [paymentResult, setPaymentResult] = React.useState<{
    transactionId: string;
    status: string;
  } | null>(null);
  const [otpChallengeId, setOtpChallengeId] = React.useState<string | null>(null);
  const [otpDestination, setOtpDestination] = React.useState("info@borabond.com");
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSending, setOtpSending] = React.useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = React.useState(false);
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const idempotencyKeyRef = React.useRef<string | null>(null);

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => {
    setStep((s) => {
      if (s === 4) idempotencyKeyRef.current = null;
      return Math.max(s - 1, 1);
    });
  };

  const remittanceBlockers = (userDetail?.eligibility?.blockers ?? []).filter(
    (b) =>
      b.code !== "ONBOARDING_INCOMPLETE" &&
      b.code !== "CYBRID_NOT_LINKED" &&
      b.code !== "CYBRID_NOT_VERIFIED",
  );

  const canProceed1 =
    Boolean(adminToken) &&
    Boolean(selectedUser?.is_active) &&
    !userDetailLoading &&
    remittanceBlockers.length === 0;

  const minReceive =
    payoutRail === "bank"
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
    payoutRail === "mobile_money"
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
      transferType: payoutRail,
      paymentType: "payout",
      channel: "web_app",
      amount: amountMinor,
      currency: receiveCurrency.toUpperCase(),
      recipientName: payoutRail === "bank" ? bankHolder.trim() : recipientName.trim(),
      deviceType: "Web",
      amountSend: transferCents,
      currencySend: "USD",
      amountReceive: recv,
      currencyReceive: receiveCurrency.toUpperCase(),
      metadata: {
        ...meta,
        recipientEntityType: isBusinessPayee ? "business" : "individual",
      },
      riskScore: 0,
      riskLevel: "LOW",
      userAgent: typeof meta.userAgent === "string" ? meta.userAgent : undefined,
    };

    if (customerRate != null && customerRate > 0) {
      base.conversionRate = customerRate;
    }

    if (bondPctNum > 0) {
      base.metadata = {
        ...(base.metadata as Record<string, unknown>),
        bondPercent: bondPctNum,
      };
    }

    const refMm = mmValidation?.providerReference?.trim();
    const refBank = bankValidation?.providerReference?.trim();
    if (payoutRail === "mobile_money" && refMm) base.referenceId = refMm;
    if (payoutRail === "bank" && refBank) base.referenceId = refBank;

    if (payoutRail === "mobile_money") {
      base.phoneNumber = normalizeMsisdn(mmPhone);
      base.network = mmNetwork;
    } else {
      base.phoneNumber = normalizeMsisdn(senderMsisdn);
      base.accountNumber = bankAccount.trim();
      base.bankSortCode = bankSortCode.trim();
    }

    if (idempotencyKeyRef.current) {
      base.idempotencyKey = idempotencyKeyRef.current;
    }

    return base;
  };

  const onRequestSendMoneyOtp = async () => {
    if (!adminToken) return;
    setOtpSending(true);
    setOtpError(null);
    try {
      const data = await adminSendMoneyOtpChallenge(adminToken);
      setOtpChallengeId(data.challenge_id);
      setOtpDestination(data.destination_email || "info@borabond.com");
      setOtpCode("");
    } catch (e) {
      setOtpError(
        e instanceof AdminApiError ? e.message : "Could not send the authorization code.",
      );
    } finally {
      setOtpSending(false);
    }
  };

  const openSendPaymentDialog = () => {
    if (!adminToken || !selectedUser) return;
    setOtpError(null);
    setSubmitError(null);
    setOtpDialogOpen(true);
    if (!otpChallengeId) {
      void onRequestSendMoneyOtp();
    }
  };

  const closeSendPaymentDialog = () => {
    if (submitting) return;
    setOtpDialogOpen(false);
  };

  const onConfirmSendFromDialog = async () => {
    if (!adminToken || !selectedUser) return;
    if (submitInFlightRef.current) return;
    if (!otpChallengeId) {
      setOtpError("The authorization code has not been sent yet. Use Resend code.");
      return;
    }
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Enter the 6-digit code emailed to the ops inbox.");
      return;
    }
    submitInFlightRef.current = true;
    setSubmitting(true);
    setOtpError(null);
    setPaymentResult(null);
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = newSendMoneyIdempotencyKey();
      }
      const verified = await adminSendMoneyOtpVerify(adminToken, otpChallengeId, code);
      const body = buildDirectPaymentBody();
      const queued = await postRemittancePaymentsViaDashboardProxy(
        adminToken,
        selectedUser.user_id,
        body,
        verified.confirmation_token,
      );
      setPaymentResult(queued);
      setOtpCode("");
      setOtpChallengeId(null);
      idempotencyKeyRef.current = null;
      setOtpDialogOpen(false);
      setStep(5);
    } catch (e) {
      const msg =
        e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : "Submit failed.";
      setOtpError(msg);
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const selectRecipientKind = (kind: RecipientKind) => {
    setRecipientKind(kind);
    setCustomerRate(null);
    setReceiveAmountLocal(null);
    setRateError(null);
    setReceiveInput("");
    setAmountEntryMode("send_usd");
    if (kind === "business") {
      setTransferType("bank");
      setMmValidation(null);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setPaymentResult(null);
    setSubmitError(null);
    setMmValidation(null);
    setBankValidation(null);
    setRecipientKind("person");
    setTransferType("mobile_money");
    setOtpChallengeId(null);
    setOtpCode("");
    setOtpError(null);
    setOtpDialogOpen(false);
    idempotencyKeyRef.current = null;
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Send money
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground md:text-[15px]">
            Pay a person (mobile money or bank) or a business (bank account only) on behalf of
            the selected customer. Staff session required (Super / Operations / Finance). Pays
            out on Pegasus directly — no Cybrid or RytePay funding.
          </p>
        </div>
        {step > 1 && step < 5 ? (
          <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={prevStep}>
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

      <Card className="w-full">
        <CardContent
          className={cn(
            "flex flex-col",
            step === 1 ? "min-h-[min(70vh,720px)] p-4 md:p-5" : "min-h-[480px] p-6 md:p-8",
          )}
        >
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                <div className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>
                      Choose the customer who owns this payout. Next you will choose whether they
                      are paying a person or a business. Send-money-only customers can be selected
                      without investment onboarding.
                    </p>
                  </div>
                </div>

                <UserSelector
                  accessToken={adminToken}
                  selected={selectedUser}
                  purpose="send-money"
                  onSelect={(u) => {
                    setSelectedUser(u);
                    setListError(null);
                    if (
                      u?.product_intent === "send_only" ||
                      u?.account_purpose === "SEND_MONEY_ONLY"
                    ) {
                      setBondPercent("0");
                    }
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
                    <div className="flex flex-wrap items-center gap-2">
                      <CustomerSegmentBadge
                        segment={userDetail.profile.customer_segment}
                        isNew={userDetail.profile.is_new_customer}
                      />
                      <PresenceIndicator
                        online={userDetail.profile.is_online}
                        lastSeenAt={userDetail.profile.last_seen_at}
                      />
                      <DeviceBadge
                        device={userDetail.profile.device}
                        userAgent={userDetail.profile.device_user_agent}
                      />
                      <ProductBadge user={userDetail.profile} />
                    </div>
                    <p>
                      <span className="text-muted-foreground">Cybrid customer</span>{" "}
                      <span className="font-mono text-foreground">
                        {customerGuid ?? "— not linked —"}
                      </span>
                    </p>
                    {remittanceBlockers.length > 0 ? (
                      <ul className="list-inside list-disc text-danger">
                        {remittanceBlockers.map((b) => (
                          <li key={b.code}>
                            {b.message}{" "}
                            <span className="text-xs opacity-80">({b.code})</span>
                          </li>
                        ))}
                      </ul>
                    ) : sendOnlyCustomer ? (
                      <p className="text-muted-foreground">
                        Send money only — investment onboarding is not required to send.
                      </p>
                    ) : null}
                  </div>
                ) : selectedUser ? (
                  <p className="text-sm text-danger">Could not load user detail.</p>
                ) : null}

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedUser
                      ? `Continue as ${selectedUser.full_name || selectedUser.email || selectedUser.user_id}`
                      : "Select a sender to continue"}
                  </p>
                  <Button
                    type="button"
                    className="h-11 gap-2 sm:min-w-[200px]"
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
                className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6"
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pay to
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={recipientKind === "person"}
                      onClick={() => selectRecipientKind("person")}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
                        recipientKind === "person"
                          ? "border-primary bg-primary-muted/40"
                          : "border-border bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <UserRound
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          recipientKind === "person" ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span>
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            recipientKind === "person" ? "text-primary" : "text-foreground",
                          )}
                        >
                          Person
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Mobile money or bank account
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={recipientKind === "business"}
                      onClick={() => selectRecipientKind("business")}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
                        recipientKind === "business"
                          ? "border-primary bg-primary-muted/40"
                          : "border-border bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <Briefcase
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          recipientKind === "business" ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span>
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            recipientKind === "business" ? "text-primary" : "text-foreground",
                          )}
                        >
                          Business
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Bank account only
                        </span>
                      </span>
                    </button>
                  </div>
                </div>

                {isBusinessPayee ? (
                  <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary-muted/20 px-4 py-3 text-sm text-foreground">
                    <Landmark className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p>
                      Business payouts go to a <span className="font-medium">bank account</span> only.
                      Mobile money is not available for this destination.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Payout method
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-pressed={transferType === "mobile_money"}
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
                        aria-pressed={transferType === "bank"}
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
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Amount
                  </p>
                  {isBusinessPayee ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Enter amount as</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-pressed={amountEntryMode === "send_usd"}
                          onClick={() => {
                            setAmountEntryMode("send_usd");
                            if (receiveAmountLocal != null && receiveAmountLocal > 0) {
                              setReceiveInput(String(receiveAmountLocal));
                            }
                          }}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                            amountEntryMode === "send_usd"
                              ? "border-primary bg-primary-muted/40 text-primary"
                              : "border-border bg-surface hover:bg-surface-muted",
                          )}
                        >
                          You send (USD)
                        </button>
                        <button
                          type="button"
                          aria-pressed={amountEntryMode === "receive_local"}
                          onClick={() => {
                            setAmountEntryMode("receive_local");
                            if (receiveAmountLocal != null && receiveAmountLocal > 0) {
                              setReceiveInput(String(receiveAmountLocal));
                            } else if (!receiveInput.trim() && sendUsdNum > 0 && customerRate != null) {
                              setReceiveInput(
                                String(lockedReceiveMajor(sendUsdNum, customerRate)),
                              );
                            }
                          }}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                            amountEntryMode === "receive_local"
                              ? "border-primary bg-primary-muted/40 text-primary"
                              : "border-border bg-surface hover:bg-surface-muted",
                          )}
                        >
                          Business receives ({receiveCurrency})
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    {isBusinessPayee && amountEntryMode === "receive_local" ? (
                      <>
                        <label className="text-xs font-medium text-foreground">
                          Business receives ({receiveCurrency})
                        </label>
                        <Input
                          inputMode="numeric"
                          value={receiveInput}
                          onChange={(e) => setReceiveInput(e.target.value)}
                          placeholder={receiveCurrency === "UGX" ? "500000" : "10000"}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          USD debit is calculated from the business rate after you fetch the rate.
                        </p>
                      </>
                    ) : (
                      <>
                        <label className="text-xs font-medium text-foreground">You send (USD)</label>
                        <Input
                          inputMode="decimal"
                          value={sendUsd}
                          onChange={(e) => setSendUsd(e.target.value)}
                          placeholder="50"
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Bond % (0–100)</label>
                    <Input
                      inputMode="numeric"
                      value={sendOnlyCustomer ? "0" : bondPercent}
                      onChange={(e) => setBondPercent(e.target.value)}
                      placeholder="0"
                      disabled={sendOnlyCustomer}
                    />
                    {sendOnlyCustomer ? (
                      <p className="text-[11px] text-muted-foreground">
                        Bond allocation is unavailable for send-money-only customers.
                      </p>
                    ) : null}
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
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={rateLoading || !adminToken || (!isBusinessPayee && !selectedUser)}
                    onClick={() => void fetchRate()}
                    className="gap-2"
                  >
                    {rateLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading rate…
                      </>
                    ) : isBusinessPayee ? (
                      "Fetch business rate"
                    ) : (
                      "Fetch customer rate"
                    )}
                  </Button>
                  {isBusinessPayee ? (
                    <span className="text-xs text-muted-foreground">
                      Uses the System Admin business rate for USD → {receiveCurrency}.
                    </span>
                  ) : useBondRate ? (
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
                  {isBusinessPayee && amountEntryMode === "receive_local" ? (
                    <>
                      <p className="text-muted-foreground">You send (approx.)</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {sendUsdNum > 0 ? `$${sendUsdNum.toFixed(2)} USD` : "—"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Recipient gets (approx.)</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {receiveAmountLocal != null
                          ? `${receiveAmountLocal.toLocaleString()} ${receiveCurrency}`
                          : "—"}
                      </p>
                    </>
                  )}
                  {isBusinessPayee && amountEntryMode === "receive_local" && receiveInputNum > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Business receives (locked payout):{" "}
                      {receiveAmountLocal != null
                        ? `${receiveAmountLocal.toLocaleString()} ${receiveCurrency}`
                        : "—"}
                      {receiveAmountLocal != null && receiveAmountLocal !== receiveInputNum
                        ? " — rounded to match USD debit and FX lock"
                        : null}
                    </p>
                  ) : null}
                  {customerRate != null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isBusinessPayee ? "Business rate" : "Customer rate"}: 1 USD → {customerRate}{" "}
                      {receiveCurrency}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Minimum receive: {minReceive} {receiveCurrency}{" "}
                    {payoutRail === "bank" ? "(bank)" : "(mobile)"}.
                  </p>
                </div>

                <Button
                  type="button"
                  className="mt-auto h-12 w-full gap-2"
                  disabled={!canProceed2}
                  onClick={nextStep}
                >
                  {isBusinessPayee ? "Business bank details" : "Recipient details"}
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
                className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {isBusinessPayee
                      ? "Business bank account"
                      : payoutRail === "bank"
                        ? "Recipient bank account"
                        : "Mobile money recipient"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isBusinessPayee
                      ? "Business payouts can only credit a bank account. Enter the registered account details."
                      : payoutRail === "bank"
                        ? "Enter the person’s bank account. Validate first when you can."
                        : "Enter the person’s mobile money number and network."}
                  </p>
                </div>

                {isBusinessPayee ? (
                  <div className="rounded-xl border border-primary/25 bg-primary-muted/15 px-4 py-3 text-sm text-foreground">
                    <p className="font-semibold">Paying a business</p>
                    <p className="mt-1 text-muted-foreground">
                      Mobile money is not available for this destination. Pegasus will credit the
                      business bank account below.
                    </p>
                  </div>
                ) : null}

                {payoutRail === "mobile_money" ? (
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
                      <label className="text-xs font-medium text-foreground">
                        {isBusinessPayee ? "Business account number" : "Account number"}
                      </label>
                      <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        {isBusinessPayee ? "Business bank" : "Bank"}
                      </label>
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
                        applyLabel={
                          isBusinessPayee
                            ? "Copy validated name into business name"
                            : "Copy validated name into account holder"
                        }
                        onApplyName={() => setBankHolder(bankValidation.accountName.trim())}
                      />
                    ) : null}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        {isBusinessPayee ? "Business / account name" : "Account holder"}
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        {isBusinessPayee
                          ? "Use the registered business name on the bank account. Validation can fill this."
                          : "Pre-filled from validation when the bank returns an account name."}
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
                className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6"
              >
                <div className="space-y-3 rounded-xl border border-border bg-surface-muted/50 p-5 text-sm">
                  <Row k="Sender user" v={selectedUser?.user_id ?? "—"} />
                  <Row k="Pay to" v={isBusinessPayee ? "Business" : "Person"} />
                  <Row
                    k={isBusinessPayee ? "Business rate" : "Customer rate"}
                    v={
                      customerRate != null
                        ? `1 USD → ${customerRate.toLocaleString()} ${receiveCurrency}`
                        : "—"
                    }
                  />
                  <Row k="Rail" v={payoutRail === "mobile_money" ? "Mobile money" : "Bank"} />
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
                    k={isBusinessPayee ? "Business name" : "Recipient"}
                    v={
                      payoutRail === "bank"
                        ? bankHolder.trim() || "—"
                        : recipientName.trim() || "—"
                    }
                  />
                  {payoutRail === "mobile_money" ? (
                    <Row
                      k="Phone / network"
                      v={`${normalizeMsisdn(mmPhone)} · ${mmNetwork}`}
                    />
                  ) : (
                    <>
                      <Row
                        k={isBusinessPayee ? "Business account" : "Account"}
                        v={bankAccount.trim()}
                      />
                      <Row
                        k="Bank"
                        v={
                          selectedBank
                            ? `${selectedBank.bankName} (${selectedBank.bankCode})`
                            : bankSortCode.trim()
                        }
                      />
                      <Row k="Sender msisdn" v={normalizeMsisdn(senderMsisdn)} />
                    </>
                  )}
                </div>

                {submitError ? (
                  <div className="rounded-xl border border-danger/40 bg-danger-muted/30 px-4 py-3 text-sm text-danger whitespace-pre-line">
                    {submitError}
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  Sending payment emails a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{otpDestination}</span>. The payout
                  only goes through after that code is confirmed.
                </p>

                <Button
                  type="button"
                  className="h-12 w-full gap-2"
                  disabled={submitting || !adminToken || !selectedUser}
                  onClick={openSendPaymentDialog}
                >
                  Send payment
                  <ArrowRight className="size-5" />
                </Button>
              </motion.div>
            ) : null}

            {step === 5 ? (
              <motion.div
                key="s5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 text-center"
              >
                <div className="flex size-20 items-center justify-center rounded-full bg-success-muted text-success">
                  <CheckCircle2 className="size-10" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Payment queued</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Provider processing was enqueued (same path as the mobile app). Final status appears in
                    {isBusinessPayee ? " Business Partner" : " Transactions"} and the work queue.
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
                    href={isBusinessPayee ? "/business-partners" : "/transactions"}
                    className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
                  >
                    {isBusinessPayee ? "Open Business Partner" : "Open transactions"}
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

      <SendMoneyOtpDialog
        open={otpDialogOpen}
        destinationEmail={otpDestination}
        code={otpCode}
        sendingCode={otpSending}
        submitting={submitting}
        error={otpError}
        onCodeChange={(value) => {
          setOtpCode(value);
          if (otpError) setOtpError(null);
        }}
        onResend={() => void onRequestSendMoneyOtp()}
        onCancel={closeSendPaymentDialog}
        onConfirm={() => void onConfirmSendFromDialog()}
      />
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
