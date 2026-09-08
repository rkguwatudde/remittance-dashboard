"use client";

import * as React from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useCanManageCustomers } from "@/hooks/use-can-manage-customers";
import {
  AdminApiError,
  adminUserLock,
  adminUserUnlock,
  isCustomerAccountLocked,
  type AdminAccountLockFields,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

type AccountLockControlsProps = {
  userId: string;
  lock: AdminAccountLockFields;
  onChanged?: () => void;
  size?: "default" | "sm";
  className?: string;
};

export function AccountLockControls({
  userId,
  lock,
  onChanged,
  size = "default",
  className,
}: AccountLockControlsProps) {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const canManage = useCanManageCustomers();
  const locked = isCustomerAccountLocked(lock);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setConfirming(false);
    setError(null);
  }, [userId, locked]);

  if (!canManage) return null;

  const runWithToken = async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = getAccessToken();
    if (!token) throw new Error("Session expired. Please sign in again.");
    try {
      return await fn(token);
    } catch (e) {
      if (!(e instanceof AdminApiError) || e.status !== 401) throw e;
      const ok = await refreshAccessToken();
      if (!ok) throw new Error("Session expired. Please sign in again.");
      const refreshed = getAccessToken();
      if (!refreshed) throw new Error("Session expired. Please sign in again.");
      return fn(refreshed);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (locked) {
        await runWithToken((token) => adminUserUnlock(token, userId));
      } else {
        await runWithToken((token) => adminUserLock(token, userId));
      }
      setConfirming(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:items-end", className)}>
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="max-w-[16rem] text-xs text-muted-foreground">
            {locked
              ? "Unlock this account? Failed login attempts will be cleared and the customer can sign in again."
              : "Lock this account? The customer will not be able to sign in until an admin unlocks it."}
          </p>
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={locked ? "default" : "destructive"}
            size={size}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Working…" : locked ? "Confirm unlock" : "Confirm lock"}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant={locked ? "default" : "outline"}
          size={size}
          onClick={() => setConfirming(true)}
        >
          {locked ? "Unlock account" : "Lock account"}
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
