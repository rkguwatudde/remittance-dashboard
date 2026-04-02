"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { adminChangePassword, AdminApiError } from "@/lib/remittance-admin-api";

export function SettingsPage() {
  const { getAccessToken } = useAuth();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const token = getAccessToken();
    if (!token) {
      setError("You are not signed in.");
      return;
    }
    if (next.length < 12 || next !== confirm) {
      setError("New password must be at least 12 characters and match confirmation.");
      return;
    }
    setLoading(true);
    try {
      const out = await adminChangePassword(token, current, next);
      setOk(out.message || "Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message);
      } else {
        setError("Could not update password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
          Security and workspace preferences for the remittance operations console.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="max-w-md space-y-4">
            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {ok ? (
              <p className="rounded-lg border border-primary/30 bg-primary-muted px-3 py-2 text-sm text-foreground">
                {ok}
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current password
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                New password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters, with uppercase, lowercase, number, and symbol.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Confirm new password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !current || !next}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Feature flags and API configuration can be wired here when your config service is ready.
        </CardContent>
      </Card>
    </div>
  );
}
