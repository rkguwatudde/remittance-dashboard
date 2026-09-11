"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminBusinessRatesList,
  adminCreateBusinessRate,
  adminDeleteBusinessRate,
  adminPatchBusinessRate,
  type AdminBusinessRateRow,
} from "@/lib/remittance-admin-api";

const RECEIVE_CURRENCIES = ["UGX", "KES", "TZS"] as const;

export function BusinessRatesCard({
  withToken,
  isSuper,
}: {
  withToken: <T>(fn: (t: string) => Promise<T>) => Promise<T>;
  isSuper: boolean;
}) {
  const [rows, setRows] = React.useState<AdminBusinessRateRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [formId, setFormId] = React.useState<string | null>(null);
  const [formSend, setFormSend] = React.useState("USD");
  const [formReceive, setFormReceive] = React.useState("UGX");
  const [formBusiness, setFormBusiness] = React.useState("");
  const [formProvider, setFormProvider] = React.useState("");
  const [formNotes, setFormNotes] = React.useState("");
  const [formActive, setFormActive] = React.useState(true);
  const [formBusy, setFormBusy] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await withToken((t) => adminBusinessRatesList(t));
      setRows(data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load business rates.");
    } finally {
      setLoading(false);
    }
  }, [withToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      r.receiveCurrency.toLowerCase().includes(needle) ||
      r.sendCurrency.toLowerCase().includes(needle) ||
      (r.notes ?? "").toLowerCase().includes(needle)
    );
  });

  const startCreate = () => {
    setFormMode("create");
    setFormId(null);
    setFormSend("USD");
    setFormReceive("UGX");
    setFormBusiness("");
    setFormProvider("");
    setFormNotes("");
    setFormActive(true);
    setFormErr(null);
    setFormOpen(true);
  };

  const startEdit = (row: AdminBusinessRateRow) => {
    setFormMode("edit");
    setFormId(row.id);
    setFormSend(row.sendCurrency);
    setFormReceive(row.receiveCurrency);
    setFormBusiness(String(row.businessRate));
    setFormProvider(row.providerRate == null ? "" : String(row.providerRate));
    setFormNotes(row.notes ?? "");
    setFormActive(row.isActive);
    setFormErr(null);
    setFormOpen(true);
  };

  const save = async () => {
    const businessRate = Number(formBusiness);
    const providerRaw = formProvider.trim();
    const providerRate = providerRaw ? Number(providerRaw) : null;
    if (!Number.isFinite(businessRate) || businessRate <= 0) {
      setFormErr("Business rate must be a positive number.");
      return;
    }
    if (providerRaw && (!Number.isFinite(providerRate) || (providerRate ?? 0) <= 0)) {
      setFormErr("Provider rate must be empty or a positive number.");
      return;
    }
    setFormBusy(true);
    setFormErr(null);
    try {
      const body = {
        send_currency: formSend,
        receive_currency: formReceive,
        business_rate: businessRate,
        provider_rate: providerRate,
        notes: formNotes.trim() || null,
        is_active: formActive,
      };
      if (formMode === "create") {
        await withToken((t) => adminCreateBusinessRate(t, body));
      } else if (formId) {
        await withToken((t) => adminPatchBusinessRate(t, formId, body));
      }
      setFormOpen(false);
      void load();
    } catch (e) {
      setFormErr(e instanceof AdminApiError ? e.message : "Save failed.");
    } finally {
      setFormBusy(false);
    }
  };

  const remove = async (row: AdminBusinessRateRow) => {
    if (!isSuper) return;
    if (
      !confirm(
        `Delete the ${row.sendCurrency}→${row.receiveCurrency} business rate? Super admin only.`,
      )
    ) {
      return;
    }
    try {
      await withToken((t) => adminDeleteBusinessRate(t, row.id));
      void load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Delete failed.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Business rates (remittance_business_rates)</CardTitle>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Separate FX for ops send-money to a business. Customer / person payouts keep using
              remittance fees above. One active rate per corridor (USD → UGX, KES, TZS).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Corridor / notes"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
            {isSuper ? (
              <Button type="button" size="sm" className="gap-1" onClick={startCreate}>
                <Plus className="size-4" />
                Add
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading business rates…</p>
          ) : error ? (
            <p className="p-4 text-sm text-danger">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No business rates yet. Super admin can add USD→UGX (or KES / TZS) here.
            </p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Corridor</th>
                  <th className="px-3 py-2">Business rate</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/80 hover:bg-surface-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.sendCurrency} → {r.receiveCurrency}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {r.businessRate.toLocaleString()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {r.providerRate == null ? "—" : r.providerRate.toLocaleString()}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted-foreground">
                      {r.notes || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.isActive ? (
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Off
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.updatedAt ? format(new Date(r.updatedAt), "MMM d HH:mm") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {isSuper ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[10px]"
                              onClick={() => startEdit(r)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-danger"
                              onClick={() => void remove(r)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {formOpen && isSuper ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">
              {formMode === "create" ? "Add business rate" : "Edit business rate"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This rate is used only when sending money to a business bank account.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Send</label>
                <Input value={formSend} onChange={(e) => setFormSend(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Receive</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  value={formReceive}
                  onChange={(e) => setFormReceive(e.target.value)}
                >
                  {RECEIVE_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Business rate</label>
                <Input
                  inputMode="decimal"
                  value={formBusiness}
                  onChange={(e) => setFormBusiness(e.target.value)}
                  placeholder="3650"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Provider rate (optional)</label>
                <Input
                  inputMode="decimal"
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  placeholder="3738"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Notes</label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Why this corridor differs from the customer rate"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                Active
              </label>
            </div>
            {formErr ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {formErr}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={formBusy} onClick={() => void save()}>
                {formBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
