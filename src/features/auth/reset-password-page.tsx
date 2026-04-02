"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminResetPassword, AdminApiError } from "@/lib/remittance-admin-api";

export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token")?.trim() ?? "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit() {
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters with upper, lower, number, and symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await adminResetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (e) {
      if (e instanceof AdminApiError) {
        setError(e.message);
      } else {
        setError("Reset failed. Request a new link.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token && !done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              This page needs a valid reset token in the URL. Use the link from your email.
            </p>
            <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted/40 px-4 py-10">
      <div className="w-full max-w-[440px] space-y-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">Set new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password you have not used elsewhere.
                </p>
              </div>

              {error ? (
                <p className="rounded-lg border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              {done ? (
                <p className="text-sm text-foreground">
                  Password updated. Redirecting to sign in…
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      New password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        className="pl-10 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={show ? "Hide password" : "Show password"}
                      >
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Confirm password
                    </label>
                    <Input
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    onClick={() => void onSubmit()}
                    disabled={loading || !password}
                  >
                    {loading ? "Saving…" : "Update password"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
