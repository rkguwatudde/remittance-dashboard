"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { motion } from "motion/react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BoraBondLockup, BoraBondMark } from "@/components/brand/borabond-logo";
import { AC_EXISTING, AC_OTP, AC_USERNAME } from "@/lib/form-autocomplete";
import {
  adminLogin,
  adminVerifyOtp,
  AdminApiError,
} from "@/lib/remittance-admin-api";

export function LoginPage() {
  const { user, isReady, completeSignIn, passwordResetRequired } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [passwordResetHint, setPasswordResetHint] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isReady || !user) return;
    router.replace(passwordResetRequired ? "/change-password" : "/");
  }, [user, isReady, passwordResetRequired, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <BoraBondMark size="lg" priority />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user) return null;

  async function onContinue() {
    setError(null);
    setLoading(true);
    try {
      const out = await adminLogin(email.trim(), password);
      if (!out.requires_2fa || !out.session_id) {
        setError("Unexpected response from server. Try again.");
        return;
      }
      setSessionId(out.session_id);
      setPasswordResetHint(!!out.password_reset_required);
      setOtp("");
      setStep(2);
    } catch (e) {
      if (e instanceof AdminApiError) {
        setError(e.message);
      } else {
        setError("Could not reach the server. Check your connection and API URL.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp() {
    if (!sessionId || otp.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const digits = otp.replace(/\D/g, "").slice(0, 6);
      const result = await adminVerifyOtp(sessionId, digits);
      completeSignIn(result);
      router.replace(result.password_reset_required ? "/change-password" : "/");
    } catch (e) {
      if (e instanceof AdminApiError) {
        setError(e.message);
      } else {
        setError("Verification failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted/40 px-4 py-10">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="space-y-3">
          <BoraBondLockup
            size="lg"
            stacked
            href={null}
            subtitle="Operations console"
            priority
          />
          <p className="text-center text-sm text-muted-foreground">
            Internal console for remittance settlement, exceptions, and rail
            health.
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            {error ? (
              <p
                className="mb-4 rounded-lg border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {step === 1 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Work email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete={AC_USERNAME}
                      placeholder="you@borabond.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={AC_EXISTING}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void onContinue();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-11 w-full gap-2 text-base"
                  onClick={() => void onContinue()}
                  disabled={loading || !email.trim() || !password}
                >
                  {loading ? "Please wait…" : "Continue"}
                  {!loading ? <ArrowRight className="size-4" /> : null}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="space-y-2 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-muted text-primary">
                    <Shield className="size-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Two-factor authentication
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to your email.
                  </p>
                  {passwordResetHint ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      After verification you will be asked to set a new password before entering the console.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="otp"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Verification code
                  </label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete={AC_OTP}
                    maxLength={6}
                    placeholder="000000"
                    className="h-14 text-center text-2xl font-semibold tracking-[0.4em]"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void onVerifyOtp();
                    }}
                  />
                </div>

                <Button
                  type="button"
                  className="h-11 w-full gap-2 text-base"
                  onClick={() => void onVerifyOtp()}
                  disabled={loading || otp.replace(/\D/g, "").length !== 6}
                >
                  {loading ? "Verifying…" : "Verify and enter console"}
                  {!loading ? <ArrowRight className="size-4" /> : null}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => {
                      setStep(1);
                      setSessionId(null);
                      setOtp("");
                      setError(null);
                    }}
                  >
                    Back to login
                  </button>
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Need access?{" "}
          <a
            href="mailto:platform@borabond.com"
            className="font-semibold text-primary hover:underline"
          >
            Contact platform admin
          </a>
        </p>
      </div>
    </div>
  );
}
