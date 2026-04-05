"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AdminApiError,
  adminUsersList,
  type AdminUserDirectoryRow,
} from "@/lib/remittance-admin-api";
import { CybridLinkStatusBadge, UserStatusBadge } from "./user-badges";
import { cn } from "@/lib/utils";

export function UserSelector({
  accessToken,
  selected,
  onSelect,
  onError,
}: {
  accessToken: string | null;
  selected: AdminUserDirectoryRow | null;
  onSelect: (u: AdminUserDirectoryRow | null) => void;
  onError: (msg: string) => void;
}) {
  const [filter, setFilter] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<AdminUserDirectoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [open, setOpen] = React.useState(true);

  const runLoad = React.useCallback(async () => {
    if (!accessToken) {
      onError("Not signed in.");
      return;
    }
    setLoading(true);
    try {
      const data = await adminUsersList(accessToken, {
        q: filter.trim() || undefined,
        limit: 100,
        offset: 0,
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
  }, [accessToken, filter, onError]);

  React.useEffect(() => {
    const t = setTimeout(() => void runLoad(), 280);
    return () => clearTimeout(t);
  }, [runLoad]);

  const canRunTransfers = (u: AdminUserDirectoryRow) =>
    u.is_active &&
    u.is_verified &&
    u.onboarding_completed !== false &&
    u.cybrid_linked &&
    (u.cybrid_verification_status || "").toLowerCase() === "verified";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search name, email, phone, user_id, or Cybrid customer id…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="font-sans"
          disabled={!accessToken}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void runLoad()}
          disabled={loading || !accessToken}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide list" : "Show list"}
        </Button>
      </div>

      {!loading && total > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Showing {rows.length} of {total} users (user_profiles). Refine search to narrow results.
        </p>
      ) : null}

      {open ? (
        <div className="max-h-[min(70vh,520px)] overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-muted/90 backdrop-blur">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Cybrid</th>
                <th className="px-3 py-2 font-medium">Onboarding</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSel = selected?.user_id === u.user_id;
                const ok = canRunTransfers(u);
                return (
                  <tr
                    key={u.user_id}
                    className={cn(
                      "border-b border-border/80 last:border-0",
                      isSel && "bg-primary-muted/50",
                    )}
                  >
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                      <p className="text-muted-foreground">{u.email || "—"}</p>
                      <p className="text-muted-foreground">{u.phone || "—"}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{u.user_id}</p>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <UserStatusBadge isVerified={u.is_verified} isActive={u.is_active} />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        KYC: {u.verification_status || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <CybridLinkStatusBadge linked={u.cybrid_linked} />
                      {u.cybrid_customer_id ? (
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                          {u.cybrid_customer_id}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                      {u.onboarding_completed === null
                        ? "—"
                        : u.onboarding_completed
                          ? "Done"
                          : "Incomplete"}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSel ? "secondary" : "default"}
                        disabled={!ok}
                        onClick={() => onSelect(u)}
                        title={
                          !ok
                            ? "Requires active + verified user, Cybrid link, and Cybrid verified"
                            : undefined
                        }
                      >
                        {isSel ? "Selected" : "Select"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No users match. Adjust search or open Users for full directory.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <div
          className={cn(
            "rounded-lg border p-3",
            canRunTransfers(selected)
              ? "border-border bg-surface-muted/30"
              : "border-warning/50 bg-warning-muted/20",
          )}
        >
          <p className="text-xs font-semibold text-foreground">Active user</p>
          <p className="font-mono text-[11px] text-muted-foreground">{selected.user_id}</p>
          {!selected.cybrid_linked ? (
            <p className="mt-2 text-xs text-danger">User not linked to Cybrid — transfers disabled.</p>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => onSelect(null)}
          >
            Clear selection
          </Button>
        </div>
      ) : null}
    </div>
  );
}
