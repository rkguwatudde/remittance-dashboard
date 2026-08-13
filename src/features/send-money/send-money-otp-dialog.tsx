"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AC_OTP } from "@/lib/form-autocomplete";

type SendMoneyOtpDialogProps = {
  open: boolean;
  destinationEmail: string;
  code: string;
  sendingCode: boolean;
  submitting: boolean;
  error: string | null;
  onCodeChange: (value: string) => void;
  onResend: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SendMoneyOtpDialog({
  open,
  destinationEmail,
  code,
  sendingCode,
  submitting,
  error,
  onCodeChange,
  onResend,
  onCancel,
  onConfirm,
}: SendMoneyOtpDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, submitting, onCancel]);

  if (!mounted) return null;

  const canConfirm = /^\d{6}$/.test(code.trim()) && !sendingCode && !submitting;

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
            onClick={() => {
              if (!submitting) onCancel();
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-money-otp-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-floating)]"
          >
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 id="send-money-otp-title" className="text-base font-semibold text-foreground">
                  Confirm send payment
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code emailed to{" "}
                  <span className="font-medium text-foreground">{destinationEmail}</span>. An
                  invalid code will not send money.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-xs font-medium text-foreground" htmlFor="send-money-otp">
                Authorization code
              </label>
              <Input
                ref={inputRef}
                id="send-money-otp"
                inputMode="numeric"
                autoComplete={AC_OTP}
                maxLength={6}
                value={code}
                disabled={submitting}
                onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConfirm) onConfirm();
                }}
                placeholder="••••••"
                className="h-12 font-mono text-lg tracking-[0.4em]"
              />
            </div>

            {sendingCode ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Sending code to {destinationEmail}…
              </p>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={sendingCode || submitting}
                onClick={onResend}
              >
                Resend code
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Confirm & send"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
