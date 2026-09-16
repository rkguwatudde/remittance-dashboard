"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AdminApiError,
  adminBanksList,
  adminCreateSavedRecipient,
  adminDeleteSavedRecipient,
  adminSavedRecipientsList,
  adminUpdateSavedRecipient,
  type AdminBankListItem,
  type AdminSavedRecipientRow,
} from "@/lib/remittance-admin-api";

import { DeleteRecipientDialog } from "./delete-recipient-dialog";
import { RecipientEmptyState } from "./recipient-empty-state";
import { RecipientFilters, type RecipientTab } from "./recipient-filters";
import { RecipientFormDrawer } from "./recipient-form-drawer";
import { RecipientSearchBar } from "./recipient-search-bar";
import { RecipientTable } from "./recipient-table";

const PAGE_SIZE = 12;

const RECIPIENTS_VIEWPORT =
  "mx-auto flex h-[calc(100dvh-7.5rem)] min-h-0 max-w-[1760px] flex-col gap-3 overflow-hidden sm:h-[calc(100dvh-7rem)]";

export function RecipientsPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [rows, setRows] = React.useState<AdminSavedRecipientRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [frequentMin, setFrequentMin] = React.useState(3);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<RecipientTab>("all");
  const [countryCode, setCountryCode] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);

  const [banks, setBanks] = React.useState<AdminBankListItem[]>([]);
  const [banksLoading, setBanksLoading] = React.useState(false);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState<"add" | "edit">("add");
  const [editRow, setEditRow] = React.useState<AdminSavedRecipientRow | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<AdminSavedRecipientRow | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const loadBanks = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setBanksLoading(true);
    try {
      const b = await adminBanksList(token);
      setBanks(b);
    } catch {
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  }, [getAccessToken]);

  const buildListParams = React.useCallback(
    () => ({
      limit: PAGE_SIZE,
      offset,
      q: q || undefined,
      tab,
      country_code: countryCode.trim() || undefined,
      include_inactive: showInactive,
    }),
    [offset, q, tab, countryCode, showInactive],
  );

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setListError("Sign in to load recipients.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const res = await adminSavedRecipientsList(token, buildListParams());
      setRows(res.recipients);
      setTotal(res.pagination.total);
      setFrequentMin(res.meta.frequent_min_sends);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          const next = getAccessToken();
          if (next) {
            const res = await adminSavedRecipientsList(next, buildListParams());
            setRows(res.recipients);
            setTotal(res.pagination.total);
            setFrequentMin(res.meta.frequent_min_sends);
            setLoading(false);
            return;
          }
        }
      }
      setListError(err instanceof AdminApiError ? err.message : "Could not load recipients.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, refreshAccessToken, buildListParams]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  React.useEffect(() => {
    setOffset(0);
  }, [tab, countryCode, showInactive]);

  const openAdd = () => {
    setFormError(null);
    setEditRow(null);
    setDrawerMode("add");
    setDrawerOpen(true);
    void loadBanks();
  };

  const openEdit = (row: AdminSavedRecipientRow) => {
    setFormError(null);
    setEditRow(row);
    setDrawerMode("edit");
    setDrawerOpen(true);
    void loadBanks();
  };

  const handleFormSubmit = async (payload: Parameters<typeof adminCreateSavedRecipient>[1]) => {
    const token = getAccessToken();
    if (!token) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await adminCreateSavedRecipient(token, payload);
      setDrawerOpen(false);
      await load();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setFormError(err.message);
        if (err.status === 401) await refreshAccessToken();
      } else {
        setFormError("Could not create recipient.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleFormEdit = async (id: string, body: Record<string, string | undefined>) => {
    const token = getAccessToken();
    if (!token) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await adminUpdateSavedRecipient(token, id, body);
      setDrawerOpen(false);
      setEditRow(null);
      await load();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setFormError(err.message);
        if (err.status === 401) await refreshAccessToken();
      } else {
        setFormError("Could not update recipient.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const openDisable = (row: AdminSavedRecipientRow) => {
    setDeleteRow(row);
    setDeleteOpen(true);
  };

  const confirmDisable = async () => {
    if (!deleteRow) return;
    const token = getAccessToken();
    if (!token) return;
    setDeleteLoading(true);
    try {
      await adminDeleteSavedRecipient(token, deleteRow.id);
      setDeleteOpen(false);
      setDeleteRow(null);
      await load();
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) await refreshAccessToken();
    } finally {
      setDeleteLoading(false);
    }
  };

  const onMore = (row: AdminSavedRecipientRow) => {
    openEdit(row);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasFilters = Boolean(q || countryCode || showInactive || tab !== "all");

  const paginationBar = (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border/80 bg-surface-muted/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground sm:text-sm">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)}
        </span>{" "}
        of <span className="font-semibold text-foreground">{total}</span>
        {pageCount > 1 ? (
          <span>
            {" "}
            · Page {page} / {pageCount}
          </span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-lg"
          disabled={offset <= 0 || loading}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-lg"
          disabled={offset + PAGE_SIZE >= total || loading}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className={RECIPIENTS_VIEWPORT}>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Recipients
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Saved beneficiaries · search, filter, and manage repeat-send contacts
          </p>
        </div>
        <Button type="button" size="sm" className="shrink-0 gap-2 rounded-lg shadow-sm" onClick={openAdd}>
          <Plus className="size-4" />
          Add recipient
        </Button>
      </div>

      <Card className="shrink-0 space-y-3 rounded-xl border-border/80 p-3 shadow-[var(--shadow-card)] md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <RecipientSearchBar value={qInput} onChange={setQInput} />
        </div>
        <RecipientFilters
          tab={tab}
          onTab={(t) => {
            setTab(t);
            setOffset(0);
          }}
          countryCode={countryCode}
          onCountry={(c) => {
            setCountryCode(c);
            setOffset(0);
          }}
          showInactive={showInactive}
          onShowInactive={(v) => {
            setShowInactive(v);
            setOffset(0);
          }}
        />
      </Card>

      {listError ? (
        <p className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {listError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!loading && rows.length === 0 ? (
          <RecipientEmptyState onAdd={openAdd} hasFilters={hasFilters} embedded />
        ) : (
          <>
            <RecipientTable
              fillViewport
              loading={loading}
              rows={rows}
              frequentMinSends={frequentMin}
              onEdit={openEdit}
              onDisable={openDisable}
              onMore={onMore}
            />
            {paginationBar}
          </>
        )}
      </div>

      <RecipientFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={editRow}
        banks={banks}
        banksLoading={banksLoading}
        submitting={formSubmitting}
        serverError={formError}
        onClose={() => {
          setDrawerOpen(false);
          setEditRow(null);
          setFormError(null);
        }}
        onSubmit={handleFormSubmit}
        onSubmitEdit={handleFormEdit}
      />

      <DeleteRecipientDialog
        open={deleteOpen}
        recipient={deleteRow}
        loading={deleteLoading}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteRow(null);
        }}
        onConfirmDisable={() => void confirmDisable()}
      />
    </div>
  );
}
