"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminForgotPassword, AdminApiError } from "@/lib/remittance-admin-api";

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const out = await adminForgotPassword(email.trim());
      setDone(true);
      if (out.message) {
        /* message is generic; show it */
      }
    } catch (e) {
      if (e instanceof AdminApiError) {
        setError(e.message);
      } else {
        setError("Request failed. Try again later.");
      }
    } finally {
      setLoading(false);
    }
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
                <h1 className="text-xl font-semibold text-foreground">
                  Reset password
                </h1>
                <p className="text-sm text-muted-foreground">
                  If an account exists for this email, you will receive a secure link shortly.
                </p>
              </div>

              {error ? (
                <p className="rounded-lg border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              {done ? (
                <p className="text-sm text-foreground">
                  Check your inbox for instructions. If you do not see an email, verify the address
                  or contact your administrator.
                </p>
              ) : (
                <>
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
                        autoComplete="username"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    onClick={() => void onSubmit()}
                    disabled={loading || !email.trim()}
                  >
                    {loading ? "Sending…" : "Send reset link"}
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
