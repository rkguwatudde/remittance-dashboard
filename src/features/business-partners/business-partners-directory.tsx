"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, Pencil, Plus, Search, Send } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminBanksList,
  adminBusinessPartnersList,
  adminCreateBusinessPartner,
  adminPatchBusinessPartner,
  type AdminBankListItem,
  type AdminBusinessPartnerRow,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { BusinessPartnerDetailDrawer } from "./business-partner-detail-drawer";
import { BusinessPartnerFormDrawer } from "./business-partner-form-drawer";

function displayName(p: AdminBusinessPartnerRow): string {
  return p.tradingName?.trim() || p.legalName;
}

function maskAccount(acct: string | null): string {
  const a = acct?.trim();
  if (!a) return "—";
  return a.length > 6 ? `…${a.slice(-6)}` : a;
}

export function BusinessPartnersDirectory() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [partners, setPartners] = React.useState<AdminBusinessPartnerRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");

  const [banks, setBanks] = React.useState<AdminBankListItem[]>([]);
  const [banksLoading, setBanksLoading] = React.useState(false);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState<"create" | "edit">("create");
  const [editRow, setEditRow] = React.useState<AdminBusinessPartnerRow | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailPartner, setDetailPartner] = React.useState<AdminBusinessPartnerRow | null>(null);
  const [notesSaving, setNotesSaving] = React.useState(false);
  const [notesError, setNotesError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const withToken = React.useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      let token = getAccessToken();
      if (!token) {
        const ok = await refreshAccessToken();
        if (ok) token = getAccessToken();
      }
      if (!token) throw new AdminApiError("Not signed in.", "UNAUTHORIZED", 401);
      setAccessToken(token);
      return fn(token);
    },
    [getAccessToken, refreshAccessToken],
  );

  const load = React.useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await withToken((t) =>
        adminBusinessPartnersList(t, { q: q || undefined, limit: 100 }),
      );
      setPartners(data.partners);
      setTotal(data.total);
    } catch (e) {
      setListError(e instanceof AdminApiError ? e.message : "Failed to load business partners.");
    } finally {
      setLoading(false);
    }
  }, [q, withToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setBanksLoading(true);
    void withToken((t) => adminBanksList(t))
      .then(setBanks)
      .catch(() => setBanks([]))
      .finally(() => setBanksLoading(false));
  }, [withToken]);

  const openCreate = () => {
    setDrawerMode("create");
    setEditRow(null);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openDetail = (row: AdminBusinessPartnerRow) => {
    setDetailPartner(row);
    setNotesError(null);
    setDetailOpen(true);
  };

  const openEdit = (row: AdminBusinessPartnerRow) => {
    setDetailOpen(false);
    setDrawerMode("edit");
    setEditRow(row);
    setFormError(null);
    setDrawerOpen(true);
  };

  const refreshPartnerInState = (updated: AdminBusinessPartnerRow) => {
    setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setDetailPartner((prev) => (prev?.id === updated.id ? updated : prev));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">Business partners</h2>
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="size-4" />
          Register business
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or account…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>

      {listError ? (
        <p className="text-sm text-danger" role="alert">
          {listError}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : partners.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Building2 className="size-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No business partners yet.</p>
            <Button type="button" variant="secondary" onClick={openCreate}>
              Register business
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Corridor</th>
                  <th className="px-4 py-3 font-medium">Bank</th>
                  <th className="px-4 py-3 font-medium">Validation</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-border/80 hover:bg-surface-muted/20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => openDetail(p)}
                      >
                        <p className="font-medium text-foreground">{displayName(p)}</p>
                        {p.tradingName ? (
                          <p className="text-xs text-muted-foreground">{p.legalName}</p>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.countryCode} · {p.receiveCurrency}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.bankName ? `${p.bankName} · ${maskAccount(p.bankAccountNumber)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.hasValidatedBank ? (
                        <Badge variant="success">Validated</Badge>
                      ) : p.bankAccountNumber ? (
                        <Badge variant="warning">Not validated</Badge>
                      ) : (
                        <Badge variant="secondary">No bank</Badge>
                      )}
                      {p.bankValidatedAt ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {format(new Date(p.bankValidatedAt), "MMM d, yyyy")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(p)}>
                          Details
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Link
                          href={`/transfer?tab=send&partnerId=${encodeURIComponent(p.id)}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 inline-flex")}
                        >
                          <Send className="size-4" />
                          Send
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && total > partners.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {partners.length} of {total}. Refine search to see more.
        </p>
      ) : null}

      <BusinessPartnerDetailDrawer
        open={detailOpen}
        partner={detailPartner}
        savingNotes={notesSaving}
        notesError={notesError}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          if (detailPartner) openEdit(detailPartner);
        }}
        onSaveNotes={async (notes) => {
          if (!detailPartner) return;
          setNotesSaving(true);
          setNotesError(null);
          try {
            const updated = await withToken((t) =>
              adminPatchBusinessPartner(t, detailPartner.id, { notes: notes || null }),
            );
            refreshPartnerInState(updated);
          } catch (e) {
            setNotesError(e instanceof AdminApiError ? e.message : "Could not save narration.");
          } finally {
            setNotesSaving(false);
          }
        }}
      />

      <BusinessPartnerFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={editRow}
        banks={banks}
        banksLoading={banksLoading}
        accessToken={accessToken}
        submitting={formSubmitting}
        serverError={formError}
        onClose={() => setDrawerOpen(false)}
        onCreate={async (body) => {
          setFormSubmitting(true);
          setFormError(null);
          try {
            const partner = await withToken((t) => adminCreateBusinessPartner(t, body));
            await load();
            openDetail(partner);
            return partner;
          } catch (e) {
            const msg = e instanceof AdminApiError ? e.message : "Create failed.";
            setFormError(msg);
            throw e;
          } finally {
            setFormSubmitting(false);
          }
        }}
        onPatch={async (id, body) => {
          setFormSubmitting(true);
          setFormError(null);
          try {
            const partner = await withToken((t) =>
              adminPatchBusinessPartner(t, id, body as Parameters<typeof adminPatchBusinessPartner>[2]),
            );
            refreshPartnerInState(partner);
            await load();
            return partner;
          } catch (e) {
            const msg = e instanceof AdminApiError ? e.message : "Update failed.";
            setFormError(msg);
            throw e;
          } finally {
            setFormSubmitting(false);
          }
        }}
      />
    </div>
  );
}
