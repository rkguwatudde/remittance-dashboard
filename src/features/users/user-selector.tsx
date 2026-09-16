"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AdminApiError,
  adminUsersList,
  isCustomerAccountLocked,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { CustomerSegmentBadge, DeviceBadge, PresenceIndicator, ProductBadge, UserStatusBadge } from "./user-badges";
import { cn } from "@/lib/utils";

function isSendMoneyOnly(u: AdminUserDirectoryRow): boolean {
  return u.product_intent === "send_only" || u.account_purpose === "SEND_MONEY_ONLY";
}

export function UserSelector({
  accessToken,
  selected,
  onSelect,
  onError,
  purpose = "transfers",
}: {
  accessToken: string | null;
  selected: AdminUserDirectoryRow | null;
  onSelect: (u: AdminUserDirectoryRow | null) => void;
  onError: (msg: string) => void;
  /** Remittance send does not require investment onboarding or a Cybrid bank link. */
  purpose?: "send-money" | "transfers";
}) {
  const [filter, setFilter] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<AdminUserDirectoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [open, setOpen] = React.useState(true);
  const isSendMoney = purpose === "send-money";
  const pageSize = isSendMoney ? 8 : 100;
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    if (isSendMoney && selected) {
      setOpen(false);
    }
  }, [isSendMoney, selected?.user_id]);

  React.useEffect(() => {
    setOffset(0);
  }, [filter, isSendMoney]);

  const runLoad = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!accessToken) {
      onError("Not signed in.");
      return;
    }
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const data = await adminUsersList(accessToken, {
        q: filter.trim() || undefined,
        limit: pageSize,
        offset: isSendMoney ? offset : 0,
      });
      setRows(data.users);
      setTotal(data.pagination.total);
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : "Failed to load users.";
      onError(msg);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter, onError, offset, pageSize, isSendMoney]);

  React.useEffect(() => {
    const t = setTimeout(() => void runLoad(), 280);
    return () => clearTimeout(t);
  }, [runLoad]);

  React.useEffect(() => {
    if (!accessToken) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void runLoad({ silent: true });
    }, 20000);
    return () => window.clearInterval(id);
  }, [accessToken, runLoad]);

  const canSelect = (u: AdminUserDirectoryRow) => {
    if (!u.is_active) return false;
    if (purpose === "send-money") return true;
    return (
      u.is_verified &&
      u.onboarding_completed !== false &&
      u.cybrid_linked &&
      (u.cybrid_verification_status || "").toLowerCase() === "verified"
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", !isSendMoney && "min-h-0 flex-1")}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, user id, or Cybrid customer id…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-11 pl-9 font-sans"
            disabled={!accessToken}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runLoad()}
            disabled={loading || !accessToken}
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide list" : "Show list"}
          </Button>
        </div>
      </div>

      {!loading && total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {isSendMoney
            ? `Showing ${offset + 1}–${Math.min(offset + rows.length, total)} of ${total} — search to narrow.`
            : `Showing ${rows.length} of ${total} users (user_profiles). Refine search to narrow results.`}
        </p>
      ) : null}

      {selected ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2",
            canSelect(selected)
              ? "border-primary/40 bg-primary-muted/20"
              : "border-warning/50 bg-warning-muted/20",
            isSendMoney && "py-2.5",
          )}
        >
          <div className="min-w-0">
            {isSendMoney ? (
              <>
                <p className="truncate text-sm font-semibold text-foreground">
                  {selected.full_name || selected.email || "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[selected.email, selected.phone].filter(Boolean).join(" · ") || selected.user_id}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected sender
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {selected.full_name || "—"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[selected.email, selected.phone].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{selected.user_id}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CustomerSegmentBadge
                    segment={selected.customer_segment}
                    isNew={selected.is_new_customer}
                  />
                  <PresenceIndicator online={selected.is_online} lastSeenAt={selected.last_seen_at} />
                  <DeviceBadge device={selected.device} userAgent={selected.device_user_agent} />
                  <ProductBadge user={selected} />
                </div>
                {!selected.cybrid_linked ? (
                  <p className="mt-1 text-xs text-danger">User not linked to Cybrid — transfers disabled.</p>
                ) : null}
                {!selected.is_verified ? (
                  <p className="mt-1 text-xs text-warning">User is not KYC verified on profile.</p>
                ) : null}
                {!selected.is_active ? (
                  <p className="mt-1 text-xs text-danger">Account is disabled.</p>
                ) : null}
                {selected.cybrid_linked &&
                (selected.cybrid_verification_status || "").toLowerCase() !== "verified" ? (
                  <p className="mt-1 text-xs text-warning">
                    Cybrid customer not verified ({selected.cybrid_verification_status || "n/a"}).
                  </p>
                ) : null}
                {selected.warnings.map((w) => (
                  <p key={w} className="mt-1 text-[11px] text-warning">
                    {w}
                  </p>
                ))}
              </>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
            Clear
          </Button>
        </div>
      ) : null}

      {open ? (
        <div
          className={cn(
            "rounded-xl border border-border bg-surface",
            isSendMoney ? "overflow-x-auto" : "min-h-[360px] flex-1 overflow-auto",
          )}
        >
          <table
            className={cn(
              "w-full text-left text-sm",
              isSendMoney ? "min-w-[640px]" : "min-w-[1080px]",
            )}
          >
            <thead className="sticky top-0 z-10 bg-surface-muted/95 text-xs text-muted-foreground backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                {isSendMoney ? null : (
                  <>
                    <th className="px-4 py-2.5 font-medium">Presence</th>
                    <th className="px-4 py-2.5 font-medium">Device</th>
                  </>
                )}
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                {isSendMoney ? null : (
                  <th className="px-4 py-2.5 font-medium">User ID</th>
                )}
                <th className="px-4 py-2.5 font-medium">Status</th>
                {isSendMoney ? null : (
                  <th className="px-4 py-2.5 font-medium">Product</th>
                )}
                <th
                  className={cn(
                    "sticky right-0 bg-surface-muted/95 px-4 py-2.5 text-right font-medium",
                  )}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSel = selected?.user_id === u.user_id;
                const ok = canSelect(u);
                return (
                  <tr
                    key={u.user_id}
                    className={cn(
                      "border-b border-border/80 last:border-0",
                      isSel && "bg-primary-muted/40",
                      ok && "cursor-pointer hover:bg-surface-muted/70",
                      !ok && "opacity-70",
                    )}
                    onClick={() => {
                      if (ok) onSelect(u);
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <CustomerSegmentBadge
                          segment={u.customer_segment}
                          isNew={u.is_new_customer}
                        />
                        {isSendMoney ? <ProductBadge user={u} /> : null}
                      </div>
                    </td>
                    {isSendMoney ? null : (
                      <>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <PresenceIndicator online={u.is_online} lastSeenAt={u.last_seen_at} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <DeviceBadge device={u.device} userAgent={u.device_user_agent} />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-muted-foreground" title={u.email ?? ""}>
                      <span className="block max-w-[240px] truncate">{u.email || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                      {u.phone || "—"}
                    </td>
                    {isSendMoney ? null : (
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        <span className="block max-w-[220px] truncate" title={u.user_id}>
                          {u.user_id}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <UserStatusBadge
                        isVerified={u.is_verified}
                        isActive={u.is_active}
                        isLocked={isCustomerAccountLocked(u)}
                      />
                      {isSendMoney ? null : (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          KYC: {u.verification_status || "—"}
                        </p>
                      )}
                    </td>
                    {isSendMoney ? null : (
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <ProductBadge user={u} />
                      </td>
                    )}
                    <td
                      className={cn(
                        "sticky right-0 px-4 py-2.5 text-right",
                        isSel ? "bg-primary-muted/40" : "bg-surface",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        variant={isSel ? "secondary" : "default"}
                        disabled={!ok}
                        onClick={() => onSelect(u)}
                        title={
                          !ok
                            ? purpose === "send-money"
                              ? "Account is disabled"
                              : "Requires active + verified user, Cybrid link, and Cybrid verified"
                            : undefined
                        }
                      >
                        {isSel ? (
                          <>
                            <Check className="size-3.5" />
                            Selected
                          </>
                        ) : (
                          "Select"
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={isSendMoney ? 5 : 9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No users match. Adjust search or open Users for the full directory.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {isSendMoney && open && total > pageSize ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || offset + pageSize >= total}
            onClick={() => setOffset((o) => o + pageSize)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
