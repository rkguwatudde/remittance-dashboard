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
  adminCreateExchangeRate,
  adminDeleteExchangeRate,
  adminExchangeRatesList,
  adminPatchExchangeRate,
  type AdminRemittanceFeeRow,
} from "@/lib/remittance-admin-api";

const CURRENCY_CODES = [
  "UGX",
  "KES",
  "TZS",
  "RWF",
  "BIF",
  "ETB",
  "ZAR",
  "NGN",
  "GHS",
  "EGP",
  "MAD",
  "XOF",
  "XAF",
  "MUR",
  "BWP",
  "ZMW",
  "MWK",
  "NAD",
  "USD",
  "EUR",
  "GBP",
] as const;

const TRANSACTION_TYPES = [
  "funding",
  "deposit",
  "withdrawal",
  "trading",
  "request_money_instant",
] as const;

function parseOptionalAmount(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function derivedFees(providerRate: number, customerRate: number) {
  const borabondFee = providerRate - customerRate;
  const remittanceFee =
    providerRate > 0 && borabondFee > 0 ? (borabondFee / providerRate) * 100 : 0;
  const basisPoints = Math.round(remittanceFee * 100);
  const instant = providerRate > 0 && borabondFee > 0 ? basisPoints + 100 : null;
  return { borabondFee, remittanceFee, basisPoints, instant };
}

export function ExchangeRatesCard({
  withToken,
  isSuper,
}: {
  withToken: <T>(fn: (t: string) => Promise<T>) => Promise<T>;
  isSuper: boolean;
}) {
  const [rows, setRows] = React.useState<AdminRemittanceFeeRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [formId, setFormId] = React.useState<string | null>(null);
  const [formPlatform, setFormPlatform] = React.useState("Cybrid");
  const [formType, setFormType] = React.useState<string>("funding");
  const [formCurrency, setFormCurrency] = React.useState("UGX");
  const [formProvider, setFormProvider] = React.useState("3738");
  const [formCustomer, setFormCustomer] = React.useState("3698");
  const [formHasBond, setFormHasBond] = React.useState(false);
  const [formMin, setFormMin] = React.useState("");
  const [formMax, setFormMax] = React.useState("");
  const [formActive, setFormActive] = React.useState(true);
  const [formRequestInstant, setFormRequestInstant] = React.useState("100");
  const [formBusy, setFormBusy] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await withToken((t) => adminExchangeRatesList(t));
      setRows(data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load remittance fees.");
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
      r.currency.toLowerCase().includes(needle) ||
      r.platform.toLowerCase().includes(needle) ||
      r.transactionType.toLowerCase().includes(needle)
    );
  });

  const startCreate = () => {
    if (!isSuper) return;
    setFormMode("create");
    setFormId(null);
    setFormPlatform("Cybrid");
    setFormType("funding");
    setFormCurrency("UGX");
    setFormProvider("3738");
    setFormCustomer("3698");
    setFormHasBond(false);
    setFormMin("");
    setFormMax("");
    setFormActive(true);
    setFormRequestInstant("100");
    setFormErr(null);
    setFormOpen(true);
  };

  const startEdit = (row: AdminRemittanceFeeRow) => {
    setFormMode("edit");
    setFormId(row.id);
    setFormPlatform(row.platform);
    setFormType(row.transactionType);
    setFormCurrency(row.currency);
    setFormProvider(String(row.providerRate));
    setFormCustomer(String(row.customerRate));
    setFormHasBond(row.hasBoughtBond);
    setFormMin(row.minAmount == null ? "" : String(row.minAmount));
    setFormMax(row.maxAmount == null ? "" : String(row.maxAmount));
    setFormActive(row.isActive);
    setFormRequestInstant(row.requestMoneyInstant == null ? "" : String(row.requestMoneyInstant));
    setFormErr(null);
    setFormOpen(true);
  };

  const preview = derivedFees(Number(formProvider), Number(formCustomer));

  const submit = async () => {
    const providerRate = Number(formProvider);
    const customerRate = Number(formCustomer);
    if (!Number.isFinite(providerRate) || providerRate <= 0) {
      setFormErr("Provider rate must be greater than 0.");
      return;
    }
    if (!Number.isFinite(customerRate) || customerRate <= 0) {
      setFormErr("Customer rate must be greater than 0.");
      return;
    }
    const minAmount = parseOptionalAmount(formMin);
    const maxAmount = parseOptionalAmount(formMax);
    if (minAmount === undefined) {
      setFormErr("Min amount must be a number or empty.");
      return;
    }
    if (maxAmount === undefined) {
      setFormErr("Max amount must be a number or empty.");
      return;
    }
    const requestMoneyInstantRaw = formRequestInstant.trim();
    let requestMoneyInstant: number | null = 100;
    if (requestMoneyInstantRaw) {
      requestMoneyInstant = Number(requestMoneyInstantRaw);
      if (!Number.isInteger(requestMoneyInstant)) {
        setFormErr("Request-money instant must be an integer.");
        return;
      }
    } else {
      requestMoneyInstant = null;
    }

    setFormBusy(true);
    setFormErr(null);
    try {
      const body = {
        platform: formPlatform.trim() || "Cybrid",
        transaction_type: formType,
        currency: formCurrency,
        provider_rate: providerRate,
        customer_rate: customerRate,
        has_bought_bond: formHasBond,
        min_amount: minAmount,
        max_amount: maxAmount,
        is_active: formActive,
        request_money_instant: requestMoneyInstant,
      };
      if (formMode === "create") {
        await withToken((t) => adminCreateExchangeRate(t, body));
      } else if (formId) {
        await withToken((t) => adminPatchExchangeRate(t, formId, body));
      }
      setFormOpen(false);
      void load();
    } catch (e) {
      setFormErr(e instanceof AdminApiError ? e.message : "Save failed.");
    } finally {
      setFormBusy(false);
    }
  };

  const remove = async (row: AdminRemittanceFeeRow) => {
    if (!isSuper) return;
    if (
      !confirm(
        `Delete ${row.currency} ${row.transactionType} (${row.platform}${row.hasBoughtBond ? ", bond" : ""}) fee row? Super admin only.`,
      )
    ) {
      return;
    }
    try {
      await withToken((t) => adminDeleteExchangeRate(t, row.id));
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
            <CardTitle className="text-base">Remittance fees (remittance_fees_config)</CardTitle>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Live send-money FX and fee tiers for person / customer payouts. Customer rate is what
              the user sees; provider rate is the rail. Business payouts use the separate Business
              rates table below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Currency / type / platform"
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
            <p className="p-4 text-sm text-muted-foreground">Loading fees…</p>
          ) : error ? (
            <p className="p-4 text-sm text-danger">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No remittance fee rows match.</p>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Fee %</th>
                  <th className="px-3 py-2">Bps / instant</th>
                  <th className="px-3 py-2">Flags</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/80 hover:bg-surface-muted/40">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{r.currency}</div>
                      <div className="text-[11px] text-muted-foreground">{r.platform}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.transactionType}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.providerRate.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {r.customerRate.toLocaleString()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.remittanceFee.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {r.basisPoints}
                      {r.instant != null ? ` / ${r.instant}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.hasBoughtBond ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Bond
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            New
                          </Badge>
                        )}
                        {r.isActive ? (
                          <Badge variant="success" className="text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Off
                          </Badge>
                        )}
                      </div>
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
              {formMode === "create"
                ? "Add remittance fee"
                : `Edit ${formCurrency} ${formType}`}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              BoraBond fee = provider − customer. Remittance % and instant update automatically.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground">Platform</label>
                <Input
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  className="mt-1 text-sm"
                  placeholder="Cybrid"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Transaction type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 font-mono text-sm"
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Currency</label>
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 font-mono text-sm"
                >
                  {CURRENCY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Provider rate
                </label>
                <Input
                  value={formProvider}
                  onChange={(e) => setFormProvider(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Customer rate
                </label>
                <Input
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Min amount</label>
                <Input
                  value={formMin}
                  onChange={(e) => setFormMin(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  inputMode="decimal"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Max amount</label>
                <Input
                  value={formMax}
                  onChange={(e) => setFormMax(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  inputMode="decimal"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Request-money instant
                </label>
                <Input
                  value={formRequestInstant}
                  onChange={(e) => setFormRequestInstant(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  inputMode="numeric"
                  placeholder="100"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formHasBond}
                    onChange={(e) => setFormHasBond(e.target.checked)}
                  />
                  Has bought bond
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <div className="col-span-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                BoraBond {Number.isFinite(preview.borabondFee) ? preview.borabondFee.toFixed(4) : "—"}
                {" · "}
                {Number.isFinite(preview.remittanceFee) ? preview.remittanceFee.toFixed(4) : "—"}%
                {" · "}
                {preview.basisPoints} bps
                {preview.instant != null ? ` · instant ${preview.instant}` : ""}
              </div>
              {formErr ? <p className="col-span-2 text-sm text-danger">{formErr}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={formBusy} onClick={() => void submit()}>
                {formBusy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
