"use client";

import * as React from "react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Info,
  Plus,
  Search,
  Smartphone,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, title: "Amount", description: "Send / receive" },
  { id: 2, title: "Recipient", description: "Beneficiary" },
  { id: 3, title: "Review", description: "Compliance" },
  { id: 4, title: "Submitted", description: "Rail handoff" },
];

const recipients = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", avatar: "AJ" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", avatar: "BS" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", avatar: "CB" },
];

export function SendMoneyFlow() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [amount, setAmount] = React.useState("1000");
  const [selectedRecipient, setSelectedRecipient] = React.useState<
    (typeof recipients)[0] | null
  >(null);
  const [paymentMethod, setPaymentMethod] = React.useState("bank");

  const nextStep = () => setCurrentStep((p) => Math.min(p + 1, steps.length));
  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Execute transfer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Ops-initiated payout with full audit trail (mock flow).
          </p>
        </div>
        {currentStep > 1 && currentStep < 4 ? (
          <Button variant="secondary" className="gap-2" onClick={prevStep}>
            <ChevronLeft className="size-4" />
            Back
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2 px-1 sm:flex-nowrap">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex min-w-[72px] flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  currentStep >= step.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-surface-muted text-muted-foreground",
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  step.id
                )}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    currentStep >= step.id ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
              </div>
            </div>
            {idx < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-1 mt-5 hidden h-0.5 min-w-[12px] flex-1 rounded-full sm:block",
                  currentStep > step.id ? "bg-primary" : "bg-surface-muted",
                )}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardContent className="flex min-h-[480px] flex-col p-6 md:p-8">
          <AnimatePresence mode="wait">
            {currentStep === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-1 flex-col space-y-8"
              >
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    You send
                  </label>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-transparent bg-surface-muted p-5 transition focus-within:border-primary/25 focus-within:bg-surface">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-3xl font-semibold text-foreground focus:outline-none md:text-4xl"
                      placeholder="0.00"
                    />
                    <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 shadow-sm">
                      <span className="text-lg font-semibold">USD</span>
                      <ChevronLeft className="size-4 -rotate-90 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recipient receives
                  </label>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-surface-muted p-5">
                    <div className="flex-1 text-3xl font-semibold text-muted-foreground md:text-4xl">
                      {(Number(amount) * 110.5).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 shadow-sm">
                      <span className="text-lg font-semibold">KES</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary-muted/50 p-3 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 text-primary" />
                    <span>
                      FX: 1 USD = 110.50 KES · Cover fee: $2.50 (partner pass-through)
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button className="h-12 w-full gap-2 text-base" onClick={nextStep}>
                    Continue to recipient
                    <ArrowRight className="size-5" />
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {currentStep === 2 ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-1 flex-col space-y-6"
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Search name, email, phone, or BB recipient ID…"
                    className="w-full rounded-2xl border border-transparent bg-surface-muted py-4 pl-12 pr-4 text-sm transition focus:border-primary/25 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Recent recipients
                    </h4>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      <Plus className="size-4" /> Add new
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recipients.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRecipient(r)}
                        className={cn(
                          "flex items-center gap-4 rounded-2xl border p-4 text-left transition",
                          selectedRecipient?.id === r.id
                            ? "border-primary bg-primary-muted/40 shadow-sm"
                            : "border-border bg-surface hover:border-primary/40 hover:bg-surface-muted",
                        )}
                      >
                        <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-foreground">
                          {r.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button
                    className="h-12 w-full gap-2 text-base"
                    disabled={!selectedRecipient}
                    onClick={nextStep}
                  >
                    Review &amp; compliance
                    <ArrowRight className="size-5" />
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {currentStep === 3 ? (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-1 flex-col space-y-8"
              >
                <div className="space-y-4 rounded-2xl border border-border bg-surface-muted/60 p-6">
                  {[
                    ["Recipient", selectedRecipient?.name ?? "—"],
                    ["Send amount", `$${amount} USD`],
                    ["Cover fee", "$2.50 USD"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2">
                    <span className="text-lg font-semibold text-foreground">
                      Total debit
                    </span>
                    <span className="text-2xl font-semibold text-primary">
                      ${(Number(amount) + 2.5).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Funding source
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { id: "bank", icon: Banknote, label: "Prefund wallet" },
                      { id: "card", icon: CreditCard, label: "Treasury card" },
                      { id: "mobile", icon: Smartphone, label: "MTO float" },
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border p-4 transition",
                          paymentMethod === method.id
                            ? "border-primary bg-primary-muted/40 shadow-sm"
                            : "border-border bg-surface hover:bg-surface-muted",
                        )}
                      >
                        <method.icon
                          className={cn(
                            "size-6",
                            paymentMethod === method.id
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-center text-xs font-semibold",
                            paymentMethod === method.id
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {method.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button className="h-12 w-full gap-2 text-base" onClick={nextStep}>
                    Submit to rail
                    <ArrowRight className="size-5" />
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {currentStep === 4 ? (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-1 flex-col items-center justify-center space-y-6 text-center"
              >
                <div className="flex size-24 items-center justify-center rounded-full bg-success-muted text-success shadow-lg">
                  <CheckCircle2 className="size-12" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
                    Queued for settlement
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Debit of{" "}
                    <span className="font-semibold text-foreground">
                      ${amount} USD
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-foreground">
                      {selectedRecipient?.name}
                    </span>{" "}
                    is on the payment rail. Monitor status in Transactions.
                  </p>
                </div>
                <div className="w-full max-w-sm rounded-xl border border-border bg-surface-muted p-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Internal reference
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    BB-TRX-948201-X
                  </p>
                </div>
                <div className="flex w-full max-w-sm flex-col gap-2 pt-6">
                  <Button onClick={() => setCurrentStep(1)}>Another transfer</Button>
                  <Button variant="secondary">Download receipt</Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
