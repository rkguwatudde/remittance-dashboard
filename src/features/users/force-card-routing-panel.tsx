"use client";

import * as React from "react";
import { CreditCard, Landmark } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminGetFundingControls,
  adminPatchFundingControls,
  type AdminFundingControls,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ForceCardRoutingPanel({
  customerId,
  compact = false,
}: {
  customerId: string;
  compact?: boolean;
}) {
  const { getAccessToken } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const [controls, setControls] = React.useState<AdminFundingControls | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<boolean | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token || !customerId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adminGetFundingControls(token, customerId);
      setControls(data);
    } catch (e) {
      setErr(e instanceof AdminApiError ? e.message : "Failed to load funding controls.");
      setControls(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, getAccessToken]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    void load();
  }, [isSuperAdmin, load]);

  if (!isSuperAdmin) return null;

  const forced = controls?.force_card_routing === true;

  const confirmChange = async () => {
    if (pending === null) return;
    const token = getAccessToken();
    if (!token) {
      setErr("Session expired. Please sign in again.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const data = await adminPatchFundingControls(token, customerId, {
        force_card_routing: pending,
        notes: notes.trim() || undefined,
      });
      setControls(data);
      setPending(null);
      setNotes("");
    } catch (e) {
      setErr(e instanceof AdminApiError ? e.message : "Could not update funding control.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface",
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Remittance funding
          </p>
          <h2 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Force card routing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When on, this customer can fund remittance only with a debit card. ACH / bank is
            blocked until a super admin turns this off. Bond funding still uses ACH.
          </p>
        </div>
        {loading ? (
          <Badge variant="outline">Loading…</Badge>
        ) : (
          <Badge variant={forced ? "warning" : "success"} className="gap-1">
            {forced ? (
              <>
                <CreditCard className="size-3" />
                Card only
              </>
            ) : (
              <>
                <Landmark className="size-3" />
                Bank / ACH allowed
              </>
            )}
          </Badge>
        )}
      </div>

      {err ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {err}
        </p>
      ) : null}

      {controls && !loading ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {controls.updated_by ? (
            <p>
              Last changed by <span className="font-medium text-foreground">{controls.updated_by}</span>
              {controls.updated_at ? ` · ${formatUpdatedAt(controls.updated_at)}` : ""}
            </p>
          ) : (
            <p>No override on file — default routing applies.</p>
          )}
          {controls.notes ? (
            <p>
              Note: <span className="text-foreground">{controls.notes}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {pending === null ? (
        <div className="mt-4">
          <Button
            type="button"
            variant={forced ? "secondary" : "default"}
            disabled={loading}
            onClick={() => {
              setPending(!forced);
              setNotes("");
              setErr(null);
            }}
          >
            {forced ? "Allow bank / ACH again" : "Force remittance to card"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-sm text-foreground">
            {pending
              ? "Turn on card-only remittance funding for this customer? ACH will stay blocked until a super admin removes this flag."
              : "Turn off card-only routing and restore default bank / ACH eligibility?"}
          </p>
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`force-card-notes-${customerId}`}>
              Reason (optional, saved on the flag)
            </label>
            <Input
              id={`force-card-notes-${customerId}`}
              className="mt-1"
              value={notes}
              maxLength={512}
              placeholder={
                pending ? "e.g. ACH funding return — remittance on card" : "e.g. ACH restored after review"
              }
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setPending(null);
                setNotes("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void confirmChange()}>
              {saving ? "Saving…" : pending ? "Confirm card only" : "Confirm restore ACH"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
