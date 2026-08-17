"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark, RefreshCw } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminApproveBankDeleteRequest,
  adminListBankDeleteRequests,
  adminRejectBankDeleteRequest,
  type AdminBankDeleteRequest,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

type StatusFilter = "pending" | "all" | "completed" | "rejected" | "processing";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "warning" | "outline" | "success" {
  switch (status) {
    case "pending":
      return "warning";
    case "processing":
      return "default";
    case "completed":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

export function BankDeleteRequestsPage() {
  const { getAccessToken } = useAuth();
  const [status, setStatus] = React.useState<StatusFilter>("pending");
  const [rows, setRows] = React.useState<AdminBankDeleteRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notesById, setNotesById] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adminListBankDeleteRequests(token, {
        status: status === "all" ? "all" : status,
        limit: 200,
      });
      setRows(data);
    } catch (e) {
      setErr(e instanceof AdminApiError ? e.message : "Failed to load delete requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    const token = getAccessToken();
    if (!token) {
      setErr("Session expired. Please sign in again.");
      return;
    }
    setBusyId(requestId);
    setErr(null);
    try {
      const notes = notesById[requestId]?.trim();
      if (action === "approve") {
        await adminApproveBankDeleteRequest(token, requestId, notes);
      } else {
        await adminRejectBankDeleteRequest(token, requestId, notes);
      }
      await load();
    } catch (e) {
      setErr(
        e instanceof AdminApiError
          ? e.message
          : action === "approve"
            ? "Failed to approve and delete bank."
            : "Failed to reject request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payments ops
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Bank delete requests</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            When a customer taps Remove bank account, the bank stays visible but is
            disabled for funding (<span className="font-mono text-xs">PENDING_REMOVAL</span>
            ). Approve to delete it in Cybrid, or reject to reactivate funding.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => void load()}
          className="gap-2"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pending"],
            ["processing", "Processing"],
            ["completed", "Completed"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={status === id ? "default" : "secondary"}
            onClick={() => setStatus(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {err ? (
        <p className="rounded-lg border border-danger/40 bg-danger-muted/20 px-3 py-2 text-sm text-danger">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Landmark className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No requests</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing in this filter yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const pending = row.status === "pending" || row.status === "processing";
            const busy = busyId === row.id;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      <span className="text-sm font-medium text-foreground">
                        {row.bank_name || "Bank account"}
                        {row.account_mask ? ` · ****${row.account_mask}` : ""}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.email}
                      {row.customer_id ? (
                        <>
                          {" · "}
                          <Link
                            href={`/users/${encodeURIComponent(row.customer_id)}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            View user
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      ref={row.reference_id || "—"} · source={row.source} ·{" "}
                      {formatWhen(row.created_at)}
                    </p>
                    {row.reason ? (
                      <p className="text-xs text-muted-foreground">Reason: {row.reason}</p>
                    ) : null}
                    {row.reviewed_by ? (
                      <p className="text-xs text-muted-foreground">
                        Reviewed by {row.reviewed_by}
                        {row.reviewed_at ? ` · ${formatWhen(row.reviewed_at)}` : ""}
                        {row.review_notes ? ` — ${row.review_notes}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                {pending ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Input
                      placeholder="Review notes (optional)"
                      value={notesById[row.id] ?? ""}
                      maxLength={512}
                      onChange={(e) =>
                        setNotesById((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(row.id, "approve")}
                      >
                        {busy ? "Working…" : "Approve & delete bank"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void act(row.id, "reject")}
                      >
                        Reject & reactivate
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
