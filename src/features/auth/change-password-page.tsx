"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Shield } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminChangePassword, AdminApiError } from "@/lib/remittance-admin-api";
import { passwordMeetsRequirements, passwordsMatch } from "@/lib/password-validation";
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

export function ChangePasswordPage() {
  const router = useRouter();
  const { user, getAccessToken, clearPasswordResetRequired, signOut } = useAuth();

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { pwdLenOk, complexityOk } = passwordMeetsRequirements(next);
  const pwdMatchOk = passwordsMatch(next, confirm);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = getAccessToken();
    if (!token) {
      setError("You are not signed in.");
      return;
    }
    if (!pwdLenOk || !pwdMatchOk || !complexityOk || !current) {
      setError("Meet all password requirements and enter your current password.");
      return;
    }
    setLoading(true);
    try {
      await adminChangePassword(token, current, next);
      clearPasswordResetRequired();
      router.replace("/");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted/40 px-4 py-10">
      <div className="w-full max-w-[480px] space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
            BB
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email
              ? `Before you can use the console, choose a new password for ${user.email}.`
              : "Before you can use the console, choose a new password for your account."}
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
                <ReqRow ok={pwdLenOk} label="At least 12 characters" />
                <ReqRow ok={complexityOk} label="Upper, lower, number, and symbol" />
                <ReqRow ok={pwdMatchOk} label="New password matches confirmation" />
              </ul>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pwd-current" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pwd-current"
                    type="password"
                    autoComplete="current-password"
                    className="pl-10"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="pwd-new" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New password
                </label>
                <Input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pwd-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm new password
                </label>
                <Input
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full gap-2"
                disabled={loading || !current || !next || !pwdLenOk || !pwdMatchOk || !complexityOk}
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
