"use client";

import * as React from "react";
import { CreditCard, Landmark, ShieldCheck } from "lucide-react";

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

/**
 * Shared remittance funding controls for a customer:
 * - Trust for ACH / bank (NEW only — manual_ach_override)
 * - Force card routing (wins over ACH trust)
 */
export function CustomerFundingControlsPanels({
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

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token || !customerId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adminGetFundingControls(token, customerId);
      setControls({
        ...data,
        manual_ach_override: data.manual_ach_override === true,
        force_card_routing: data.force_card_routing === true,
      });
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

  return (
    <div className={cn("grid gap-4", compact && "gap-3")}>
      {err ? (
        <p className="text-sm text-danger" role="alert">
          {err}
        </p>
      ) : null}
      <ManualAchOverrideSection
        customerId={customerId}
        compact={compact}
        controls={controls}
        loading={loading}
        onUpdated={(next) => {
          setControls(next);
          setErr(null);
        }}
        onError={setErr}
      />
      <ForceCardRoutingSection
        customerId={customerId}
        compact={compact}
        controls={controls}
        loading={loading}
        onUpdated={(next) => {
          setControls(next);
          setErr(null);
        }}
        onError={setErr}
      />
    </div>
  );
}

function ManualAchOverrideSection({
  customerId,
  compact,
  controls,
  loading,
  onUpdated,
  onError,
}: {
  customerId: string;
  compact: boolean;
  controls: AdminFundingControls | null;
  loading: boolean;
  onUpdated: (next: AdminFundingControls) => void;
  onError: (message: string | null) => void;
}) {
  const { getAccessToken } = useAuth();
  const [pending, setPending] = React.useState<boolean | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const trusted = controls?.manual_ach_override === true;
  const forceCard = controls?.force_card_routing === true;

  const confirmChange = async () => {
    if (pending === null) return;
    const token = getAccessToken();
    if (!token) {
      onError("Session expired. Please sign in again.");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const data = await adminPatchFundingControls(token, customerId, {
        manual_ach_override: pending,
        notes: notes.trim() || undefined,
      });
      onUpdated({
        ...data,
        manual_ach_override: data.manual_ach_override === true,
        force_card_routing: data.force_card_routing === true,
      });
      setPending(null);
      setNotes("");
    } catch (e) {
      onError(e instanceof AdminApiError ? e.message : "Could not update ACH trust.");
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
            New customer
          </p>
          <h2 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Trust for ACH / bank
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Young new customers are card-only by default. Turn this on to let a trusted new
            customer fund remittance with bank / ACH. The app will prompt them to link a bank.
            Turn it off (or use Force card) to put them back on debit card. Does not apply after
            they graduate to returning / trusted.
          </p>
        </div>
        {loading ? (
          <Badge variant="outline">Loading…</Badge>
        ) : (
          <Badge variant={trusted ? "success" : "outline"} className="gap-1">
            {trusted ? (
              <>
                <ShieldCheck className="size-3" />
                ACH trusted
              </>
            ) : (
              <>
                <Landmark className="size-3" />
                Default (card if young NEW)
              </>
            )}
          </Badge>
        )}
      </div>

      {forceCard && trusted ? (
        <p className="mt-3 text-sm text-warning" role="status">
          Force card routing is also on — remittance stays card-only until Force card is turned
          off. ACH trust alone cannot override Force card.
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
            <p>No ACH trust override on file — young NEW stays card-only.</p>
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
            variant={trusted ? "secondary" : "default"}
            disabled={loading}
            onClick={() => {
              setPending(!trusted);
              setNotes("");
              onError(null);
            }}
          >
            {trusted ? "Revoke ACH trust (back to card)" : "Trust for ACH / bank"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-sm text-foreground">
            {pending
              ? "Allow this NEW customer to fund remittance with bank / ACH? They stay NEW (no graduation). The app will ask them to add a bank if one is not linked."
              : "Revoke ACH trust? Young NEW customers will be required to use a debit card for remittance again."}
          </p>
          <div>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`manual-ach-notes-${customerId}`}
            >
              Reason (optional, saved on the flag)
            </label>
            <Input
              id={`manual-ach-notes-${customerId}`}
              className="mt-1"
              value={notes}
              maxLength={512}
              placeholder={
                pending
                  ? "e.g. Verified customer — allow ACH early"
                  : "e.g. Risk review — back to card"
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
              {saving ? "Saving…" : pending ? "Confirm ACH trust" : "Confirm revoke"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ForceCardRoutingSection({
  customerId,
  compact,
  controls,
  loading,
  onUpdated,
  onError,
}: {
  customerId: string;
  compact: boolean;
  controls: AdminFundingControls | null;
  loading: boolean;
  onUpdated: (next: AdminFundingControls) => void;
  onError: (message: string | null) => void;
}) {
  const { getAccessToken } = useAuth();
  const [pending, setPending] = React.useState<boolean | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const forced = controls?.force_card_routing === true;

  const confirmChange = async () => {
    if (pending === null) return;
    const token = getAccessToken();
    if (!token) {
      onError("Session expired. Please sign in again.");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const data = await adminPatchFundingControls(token, customerId, {
        force_card_routing: pending,
        notes: notes.trim() || undefined,
      });
      onUpdated({
        ...data,
        manual_ach_override: data.manual_ach_override === true,
        force_card_routing: data.force_card_routing === true,
      });
      setPending(null);
      setNotes("");
    } catch (e) {
      onError(e instanceof AdminApiError ? e.message : "Could not update funding control.");
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
            When on, this customer can fund remittance only with a debit card — including when they
            have ACH trust. Bond funding still uses ACH. Turn off to restore normal policy (young
            NEW stays card-only unless Trust for ACH is on).
          </p>
        </div>
        {loading ? (
          <Badge variant="outline">Loading…</Badge>
        ) : (
          <Badge variant={forced ? "warning" : "outline"} className="gap-1">
            {forced ? (
              <>
                <CreditCard className="size-3" />
                Card only (forced)
              </>
            ) : (
              <>
                <Landmark className="size-3" />
                Not forced
              </>
            )}
          </Badge>
        )}
      </div>

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
              onError(null);
            }}
          >
            {forced ? "Allow bank / ACH again" : "Force remittance to card"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-muted/40 p-3">
          <p className="text-sm text-foreground">
            {pending
              ? "Turn on card-only remittance funding for this customer? ACH will stay blocked until a super admin removes this flag (wins over Trust for ACH)."
              : "Turn off forced card-only routing? Young NEW customers still need Trust for ACH to use bank; returning customers follow default bank/card policy."}
          </p>
          <div>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`force-card-notes-${customerId}`}
            >
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

/** @deprecated Use CustomerFundingControlsPanels */
export function ForceCardRoutingPanel(props: { customerId: string; compact?: boolean }) {
  return <CustomerFundingControlsPanels {...props} />;
}

/** @deprecated Use CustomerFundingControlsPanels */
export function ManualAchOverridePanel(props: { customerId: string; compact?: boolean }) {
  return <CustomerFundingControlsPanels {...props} />;
}
