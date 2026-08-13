"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Shield } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConcealedInput } from "@/components/ui/concealed-input";
import { BoraBondLockup } from "@/components/brand/borabond-logo";
import { AC_EXISTING, AC_NEW } from "@/lib/form-autocomplete";
import { adminUpdateSignIn, AdminApiError } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function ReqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
          ok
            ? "bg-success text-white dark:text-foreground"
            : "bg-surface-muted ring-1 ring-border text-muted-foreground",
        )}
      >
        {ok ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className={cn(ok && "text-foreground")}>{label}</span>
    </li>
  );
}

export function MandatorySignInUpdateScreen() {
  const router = useRouter();
  const { user, getAccessToken, clearMandatorySignInUpdate, signOut } = useAuth();

  const [existingSignIn, setExistingSignIn] = React.useState("");
  const [newSignInSecret, setNewSignInSecret] = React.useState("");
  const [confirmSignInSecret, setConfirmSignInSecret] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lenOk = newSignInSecret.length >= 12;
  const matchOk = newSignInSecret.length > 0 && newSignInSecret === confirmSignInSecret;
  const hasUpper = /[A-Z]/.test(newSignInSecret);
  const hasLower = /[a-z]/.test(newSignInSecret);
  const hasNum = /\d/.test(newSignInSecret);
  const hasSym = /[^A-Za-z0-9]/.test(newSignInSecret);
  const complexityOk = hasUpper && hasLower && hasNum && hasSym;
  const hasExistingSignIn = existingSignIn.length > 0;
  const hasNewSignInSecret = newSignInSecret.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = getAccessToken();
    if (!token) {
      setError("You are not signed in.");
      return;
    }
    if (!lenOk || !matchOk || !complexityOk || !hasExistingSignIn) {
      setError("Meet all requirements and enter your existing sign-in.");
      return;
    }
    setLoading(true);
    try {
      await adminUpdateSignIn(token, existingSignIn, newSignInSecret);
      clearMandatorySignInUpdate();
      router.replace("/");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not update your sign-in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted/40 px-4 py-10">
      <div className="w-full max-w-[480px] space-y-8">
        <div className="space-y-3 text-center">
          <BoraBondLockup
            size="lg"
            stacked
            href={null}
            subtitle={null}
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set a new sign-in</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email
              ? `Before you can use the console, choose a new sign-in for ${user.email}.`
              : "Before you can use the console, choose a new sign-in for your account."}
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

            <div className="mb-6 space-y-3 rounded-xl border border-dashed border-border bg-surface-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">Requirements</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <ReqRow ok={lenOk} label="At least 12 characters" />
                <ReqRow ok={complexityOk} label="Upper, lower, number, and symbol" />
                <ReqRow ok={matchOk} label="New sign-in matches confirmation" />
              </ul>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="signin-existing" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Existing sign-in
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <ConcealedInput
                    id="signin-existing"
                    autoComplete={AC_EXISTING}
                    className="pl-10"
                    value={existingSignIn}
                    onChange={(e) => setExistingSignIn(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="signin-new" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New sign-in
                </label>
                <ConcealedInput
                  id="signin-new"
                  autoComplete={AC_NEW}
                  value={newSignInSecret}
                  onChange={(e) => setNewSignInSecret(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="signin-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm new sign-in
                </label>
                <ConcealedInput
                  id="signin-confirm"
                  autoComplete={AC_NEW}
                  value={confirmSignInSecret}
                  onChange={(e) => setConfirmSignInSecret(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full gap-2"
                disabled={
                  loading ||
                  !hasExistingSignIn ||
                  !hasNewSignInSecret ||
                  !lenOk ||
                  !matchOk ||
                  !complexityOk
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Shield className="size-4" />
                    Save and continue
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  void (async () => {
                    await signOut();
                    router.replace("/login");
                  })();
                }}
              >
                Sign out
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
