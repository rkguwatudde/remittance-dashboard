"use client";

import * as React from "react";
import {
  Check,
  KeyRound,
  LayoutGrid,
  Loader2,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { AC_EXISTING, AC_NEW } from "@/lib/form-autocomplete";
import { adminChangePassword, AdminApiError } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { AdminTeamSettings } from "./admin-team-settings";
import { SettingsSection } from "./settings-section";

type SettingsTabId = "security" | "team" | "workspace";

function initials(email: string): string {
  const base = email.split("@")[0] ?? "?";
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return base.slice(0, 2).toUpperCase();
}

export function SettingsPage() {
  const { getAccessToken, user, clearPasswordResetRequired } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();

  const [activeTab, setActiveTab] = React.useState<SettingsTabId>("security");

  const [existingSignIn, setExistingSignIn] = React.useState("");
  const [newSignInSecret, setNewSignInSecret] = React.useState("");
  const [confirmSignInSecret, setConfirmSignInSecret] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const pwdLenOk = newSignInSecret.length >= 12;
  const hasExistingSignIn = existingSignIn.length > 0;
  const hasNewSignInSecret = newSignInSecret.length > 0;
  const pwdMatchOk = newSignInSecret.length > 0 && newSignInSecret === confirmSignInSecret;
  const hasUpper = /[A-Z]/.test(newSignInSecret);
  const hasLower = /[a-z]/.test(newSignInSecret);
  const hasNum = /\d/.test(newSignInSecret);
  const hasSym = /[^A-Za-z0-9]/.test(newSignInSecret);
  const complexityOk = hasUpper && hasLower && hasNum && hasSym;

  React.useEffect(() => {
    if (!isSuperAdmin && activeTab === "team") {
      setActiveTab("security");
    }
  }, [isSuperAdmin, activeTab]);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const token = getAccessToken();
    if (!token) {
      setError("You are not signed in.");
      return;
    }
    if (!pwdLenOk || !pwdMatchOk || !complexityOk) {
      setError("Meet all password requirements below before saving.");
      return;
    }
    setLoading(true);
    try {
      const out = await adminChangePassword(token, existingSignIn, newSignInSecret);
      clearPasswordResetRequired();
      setOk(out.message || "Password updated.");
      setExistingSignIn("");
      setNewSignInSecret("");
      setConfirmSignInSecret("");
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message);
      } else {
        setError("Could not update password.");
      }
    } finally {
      setLoading(false);
    }
  }

  const tabItems: { id: SettingsTabId; label: string; icon: typeof Shield }[] = [
    { id: "security", label: "Security", icon: Shield },
    ...(isSuperAdmin ? [{ id: "team" as const, label: "Team & access", icon: Users }] : []),
    { id: "workspace", label: "Workspace", icon: LayoutGrid },
  ];

  return (
    <div className="relative mx-auto max-w-5xl pb-12">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-40 bg-gradient-to-b from-primary-muted/35 via-transparent to-transparent dark:from-primary-muted/20" />

      <div className="relative">
        <header className="flex flex-col gap-6 border-b border-border/80 pb-6 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Console</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {isSuperAdmin
                ? "Switch tabs to manage security, your team, or workspace — one focus at a time."
                : "Switch tabs to manage security or workspace — one focus at a time."}
            </p>
          </div>

          {user ? (
            <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border bg-surface/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:bg-surface-elevated/90">
              <div
                className="flex size-12 items-center justify-center rounded-xl bg-primary font-mono text-sm font-semibold text-primary-foreground shadow-inner"
                aria-hidden
              >
                {initials(user.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{user.email}</p>
                <Badge variant="secondary" className="mt-1.5 text-[10px] font-medium">
                  {user.displayRole}
                </Badge>
              </div>
            </div>
          ) : null}
        </header>

        {/* Tabs */}
        <div className="settings-page-tabs-sticky">
          <div
            className="flex gap-1 overflow-x-auto pb-px sm:gap-2"
            role="tablist"
            aria-label="Settings categories"
          >
            {tabItems.map((item) => {
              const selected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`settings-panel-${item.id}`}
                  id={`settings-tab-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(item.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const i = tabItems.findIndex((t) => t.id === item.id);
                    const nextIdx =
                      e.key === "ArrowRight"
                        ? (i + 1) % tabItems.length
                        : (i - 1 + tabItems.length) % tabItems.length;
                    setActiveTab(tabItems[nextIdx].id);
                    document.getElementById(`settings-tab-${tabItems[nextIdx].id}`)?.focus();
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-surface-muted/90 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 opacity-90" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 min-h-[320px]">
          {/* Security */}
          <div
            role="tabpanel"
            id="settings-panel-security"
            aria-labelledby="settings-tab-security"
            hidden={activeTab !== "security"}
          >
            <SettingsSection
              id="security-panel-inner"
              icon={KeyRound}
              title="Password & authentication"
              description="Use a strong, unique passphrase. You will stay signed in on other devices until those sessions expire."
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
                <div className="space-y-4 rounded-xl border border-dashed border-border bg-surface-muted/40 p-5 dark:bg-surface-muted/20">
                  <p className="text-sm font-medium text-foreground">Requirements</p>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <ReqRow ok={pwdLenOk} label="At least 12 characters" />
                    <ReqRow ok={complexityOk} label="Upper, lower, number, and symbol" />
                    <ReqRow ok={pwdMatchOk} label="New password matches confirmation" />
                  </ul>
                </div>

                <form onSubmit={onChangePassword} className="space-y-5">
                  {error ? (
                    <div
                      className="rounded-xl border border-danger/35 bg-danger-muted/40 px-4 py-3 text-sm text-danger"
                      role="alert"
                    >
                      {error}
                    </div>
                  ) : null}
                  {ok ? (
                    <div className="flex items-start gap-3 rounded-xl border border-success/35 bg-success-muted/30 px-4 py-3 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>{ok}</span>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor="pwd-current" className="text-xs font-medium text-foreground">
                      Existing sign-in
                    </label>
                    <Input
                      id="pwd-current"
                      type="password"
                      autoComplete={AC_EXISTING}
                      value={existingSignIn}
                      onChange={(e) => setExistingSignIn(e.target.value)}
                      disabled={loading}
                      className="settings-security-password-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="pwd-new" className="text-xs font-medium text-foreground">
                      New password
                    </label>
                    <Input
                      id="pwd-new"
                      type="password"
                      autoComplete={AC_NEW}
                      value={newSignInSecret}
                      onChange={(e) => setNewSignInSecret(e.target.value)}
                      disabled={loading}
                      className="settings-security-password-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="pwd-confirm" className="text-xs font-medium text-foreground">
                      Confirm new password
                    </label>
                    <Input
                      id="pwd-confirm"
                      type="password"
                      autoComplete={AC_NEW}
                      value={confirmSignInSecret}
                      onChange={(e) => setConfirmSignInSecret(e.target.value)}
                      disabled={loading}
                      className="settings-security-password-field"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        !hasExistingSignIn ||
                        !hasNewSignInSecret ||
                        !pwdLenOk ||
                        !pwdMatchOk ||
                        !complexityOk
                      }
                      className="h-11 min-w-[160px] gap-2 shadow-md shadow-primary/20"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Updating…
                        </>
                      ) : (
                        <>
                          <Shield className="size-4 opacity-90" />
                          Update password
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">Sessions elsewhere are unaffected until they expire.</p>
                  </div>
                </form>
              </div>
            </SettingsSection>
          </div>

          {/* Team */}
          {isSuperAdmin ? (
            <div
              role="tabpanel"
              id="settings-panel-team"
              aria-labelledby="settings-tab-team"
              hidden={activeTab !== "team"}
            >
              <SettingsSection
                id="team-panel-inner"
                icon={Users}
                title="Team & access"
                description="Invite dashboard admins by email. They receive a temporary password and must reset it on first sign-in."
              >
                <AdminTeamSettings />
              </SettingsSection>
            </div>
          ) : null}

          {/* Workspace */}
          <div
            role="tabpanel"
            id="settings-panel-workspace"
            aria-labelledby="settings-tab-workspace"
            hidden={activeTab !== "workspace"}
          >
            <SettingsSection
              id="workspace-panel-inner"
              icon={Sparkles}
              title="Workspace"
              description="Send money uses API gateway admin routes (staff JWT). No customer impersonation token."
            >
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-muted/30 px-6 py-14 text-center dark:bg-surface-muted/15">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
                  <Sparkles className="size-7" aria-hidden />
                </div>
                <p className="mt-5 max-w-md text-sm font-medium text-foreground">Configuration hub</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  More workspace options (feature flags, saved views) can plug in here later.
                </p>
                <Badge variant="outline" className="mt-6 text-[10px] font-normal uppercase tracking-wider">
                  Coming soon
                </Badge>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
          ok
            ? "bg-success text-white dark:text-foreground"
            : "bg-surface-muted ring-1 ring-border text-muted-foreground",
        )}
      >
        {ok ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className={cn(ok && "text-foreground")}>{label}</span>
    </li>
  );
}
