"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2, Mail, RefreshCw, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import {
  ADMIN_CREATE_ROLES,
  AdminApiError,
  adminCreateTeamMember,
  adminListTeam,
  adminUpdateTeamMember,
  type AdminTeamMember,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function memberIsActive(m: AdminTeamMember): boolean {
  return m.isActive ?? m.is_active ?? false;
}

function memberMustReset(m: AdminTeamMember): boolean {
  return m.mustResetPassword ?? m.must_reset_password ?? false;
}

function memberCreatedAt(m: AdminTeamMember): string | null {
  return m.createdAt ?? m.created_at ?? null;
}

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function AdminTeamSettings() {
  const { getAccessToken, refreshAccessToken, user } = useAuth();
  const [admins, setAdmins] = React.useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<(typeof ADMIN_CREATE_ROLES)[number]>("OPERATIONS_ADMIN");
  const [creating, setCreating] = React.useState(false);
  const [createMsg, setCreateMsg] = React.useState<string | null>(null);
  const [createErr, setCreateErr] = React.useState<string | null>(null);

  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const withToken = React.useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
      let t = getAccessToken();
      if (!t) throw new AdminApiError("Not signed in", "HTTP_401", 401);
      try {
        return await fn(t);
      } catch (e) {
        if (e instanceof AdminApiError && e.status === 401) {
          const ok = await refreshAccessToken();
          t = ok ? getAccessToken() : null;
          if (t) return await fn(t);
        }
        throw e;
      }
    },
    [getAccessToken, refreshAccessToken],
  );

  const load = React.useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const rows = await withToken((t) => adminListTeam(t));
      setAdmins(rows);
    } catch (e) {
      setAdmins([]);
      setListError(e instanceof AdminApiError ? e.message : "Could not load admins.");
    } finally {
      setLoading(false);
    }
  }, [withToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateMsg(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setCreateErr("Enter a valid email.");
      return;
    }
    setCreating(true);
    try {
      const out = await withToken((t) => adminCreateTeamMember(t, { email: trimmed, role }));
      setCreateMsg(
        out.onboarding_email_sent
          ? `${out.email} invited — they received a temporary password by email.`
          : `${out.email} created — onboarding email failed; deliver credentials securely.`,
      );
      setEmail("");
      await load();
    } catch (err) {
      setCreateErr(err instanceof AdminApiError ? err.message : "Could not create admin.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(target: AdminTeamMember, nextActive: boolean) {
    if (user?.id === target.id && !nextActive) return;
    setUpdatingId(target.id);
    try {
      await withToken((t) => adminUpdateTeamMember(t, target.id, { is_active: nextActive }));
      await load();
    } catch {
      // keep UI quiet; errors are rare for toggle
    } finally {
      setUpdatingId(null);
    }
  }

  const activeCount = admins.filter((a) => memberIsActive(a)).length;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-muted/35 px-4 py-4 dark:bg-surface-muted/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Seats</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{admins.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total admins</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/35 px-4 py-4 dark:bg-surface-muted/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{activeCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Can sign in</p>
        </div>
        <div className="flex items-center justify-end sm:col-span-1">
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh list
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-10">
        <form
          onSubmit={onCreate}
          className="space-y-5 rounded-2xl border border-border bg-gradient-to-b from-surface-muted/60 to-surface-muted/20 p-5 shadow-inner ring-1 ring-border/50 dark:from-surface-muted/30 dark:to-surface-muted/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <UserPlus className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Invite admin</p>
              <p className="text-xs text-muted-foreground">Email + role only — no password on this screen.</p>
            </div>
          </div>

          {createErr ? (
            <div className="rounded-xl border border-danger/35 bg-danger-muted/40 px-3 py-2 text-sm text-danger">
              {createErr}
            </div>
          ) : null}
          {createMsg ? (
            <div className="flex items-start gap-2 rounded-xl border border-success/35 bg-success-muted/25 px-3 py-2 text-sm text-foreground">
              <Mail className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{createMsg}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-xs font-medium text-foreground">
              Work email
            </label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={creating}
              className="h-11 border-border bg-surface font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-role" className="text-xs font-medium text-foreground">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ADMIN_CREATE_ROLES)[number])}
              disabled={creating}
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
            >
              {ADMIN_CREATE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={creating || !email.trim()}
            className="h-11 w-full gap-2 shadow-md shadow-primary/15 sm:w-auto"
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Send invitation
              </>
            )}
          </Button>
        </form>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Directory</p>
          </div>
          {listError ? (
            <div className="rounded-xl border border-danger/30 bg-danger-muted/30 px-4 py-4 text-sm text-danger">
              {listError}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              Loading directory…
            </div>
          ) : admins.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-muted/30 px-6 py-14 text-center text-sm text-muted-foreground dark:bg-surface-muted/15">
              No admins yet. Invite someone with the form on the left.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
              <div className="max-h-[min(520px,55vh)] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-surface-muted/95 backdrop-blur-sm">
                    <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="hidden px-4 py-3 md:table-cell">Onboarding</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface">
                    {admins.map((a) => {
                      const active = memberIsActive(a);
                      const mustReset = memberMustReset(a);
                      const created = memberCreatedAt(a);
                      const isSelf = user?.id === a.id;
                      const rowInitials = (() => {
                        const base = a.email.split("@")[0] ?? "?";
                        const parts = base.split(/[._-]/).filter(Boolean);
                        if (parts.length >= 2) {
                          return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
                        }
                        return base.slice(0, 2).toUpperCase();
                      })();

                      return (
                        <tr
                          key={a.id}
                          className="border-b border-border/70 transition-colors last:border-0 hover:bg-surface-muted/50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted font-mono text-[11px] font-semibold text-primary">
                                {rowInitials}
                              </div>
                              <span className="font-mono text-xs text-foreground">{a.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              {roleLabel(a.role)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                active
                                  ? "bg-success-muted text-success ring-success/25"
                                  : "bg-surface-muted text-muted-foreground ring-border",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  active ? "bg-success" : "bg-foreground/30",
                                )}
                              />
                              {active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                            {mustReset ? (
                              <span className="rounded-md bg-warning-muted/50 px-2 py-0.5 text-[10px] font-medium text-warning">
                                Reset required
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="hidden px-4 py-3 font-mono text-[11px] text-muted-foreground sm:table-cell">
                            {created ? format(new Date(created), "MMM d, yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isSelf ? (
                              <span className="text-xs font-medium text-muted-foreground">You</span>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-8 gap-1 text-xs",
                                  !active && "border-success/40 text-success hover:bg-success-muted",
                                )}
                                disabled={updatingId === a.id}
                                onClick={() => void toggleActive(a, !active)}
                              >
                                {updatingId === a.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : active ? (
                                  "Disable"
                                ) : (
                                  "Enable"
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
