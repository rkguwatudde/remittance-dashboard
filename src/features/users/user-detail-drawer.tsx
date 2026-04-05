"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { format } from "date-fns";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminApiError,
  adminUserDetail,
  type AdminUserDetailResponse,
} from "@/lib/remittance-admin-api";
import { CybridLinkStatusBadge, UserStatusBadge } from "./user-badges";
import { cn } from "@/lib/utils";

function formatSafe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "MMM d, yyyy HH:mm:ss");
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border/80 py-3 last:border-b-0 sm:grid-cols-[minmax(0,160px)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", mono && "font-mono text-[13px] break-all")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

type Tab = "profile" | "cybrid" | "activity";

type UserDetailDrawerProps = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
  onFullyClosed?: () => void;
};

export function UserDetailDrawer({
  open,
  userId,
  onClose,
  onFullyClosed,
}: UserDetailDrawerProps) {
  const { getAccessToken } = useAuth();
  const token = getAccessToken();
  const [mounted, setMounted] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("profile");
  const [data, setData] = React.useState<AdminUserDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const openRef = React.useRef(open);
  openRef.current = open;
  const holdUserIdRef = React.useRef<string | null>(null);
  if (userId) holdUserIdRef.current = userId;
  const displayUserId = userId ?? holdUserIdRef.current;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !userId || !token) {
      if (!open) {
        setErr(null);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const d = await adminUserDetail(token, userId);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof AdminApiError ? e.message : "Failed to load user.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, token]);

  React.useEffect(() => {
    if (open) setTab("profile");
  }, [open, userId]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return;
  }, [open]);

  if (!mounted || !displayUserId) return null;

  const p = data?.profile;
  const linked = Boolean(data?.cybrid?.cybrid_customer_id);

  const content = (
    <AnimatePresence
      onExitComplete={() => {
        if (!openRef.current) {
          holdUserIdRef.current = null;
          setData(null);
          onFullyClosed?.();
        }
      }}
    >
      {open ? (
        <>
          <motion.button
            key="user-drawer-backdrop"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px]"
            aria-label="Close panel"
            onClick={onClose}
          />
          <motion.aside
            key={`user-drawer-panel-${displayUserId}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-drawer-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p
                  id="user-drawer-title"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  {loading ? "User" : p?.full_name || "User"}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {displayUserId}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-5" />
              </Button>
            </div>

            {loading ? (
              <div className="flex-1 space-y-3 px-5 py-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : err ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="text-sm text-destructive">{err}</p>
              </div>
            ) : data && p ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                  <UserStatusBadge isVerified={p.is_verified} isActive={p.is_active} />
                  <CybridLinkStatusBadge linked={linked} />
                  {data.eligibility.can_transfer ? (
                    <Badge variant="success" className="text-[10px]">
                      Transfer eligible
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Transfers blocked
                    </Badge>
                  )}
                </div>

                {!data.eligibility.can_transfer && data.eligibility.blockers.length > 0 ? (
                  <div className="border-b border-border bg-warning-muted/15 px-5 py-3">
                    <p className="text-xs font-semibold text-foreground">Blockers</p>
                    <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground">
                      {data.eligibility.blockers.map((b) => (
                        <li key={b.code}>
                          <span className="font-mono">{b.code}</span> — {b.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex gap-1 border-b border-border px-5">
                  {(
                    [
                      ["profile", "Profile"],
                      ["cybrid", "Cybrid"],
                      ["activity", "Activity"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={cn(
                        "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                        tab === id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-2">
                  {tab === "profile" ? (
                    <dl>
                      <DetailItem label="Email" value={p.email} />
                      <DetailItem label="Phone" value={p.phone} />
                      <DetailItem label="Verification status" value={p.verification_status} />
                      <DetailItem
                        label="Onboarding completed"
                        value={String(p.onboarding_completed)}
                      />
                      <DetailItem
                        label="Onboarding step"
                        value={p.onboarding_step != null ? String(p.onboarding_step) : "—"}
                      />
                      <DetailItem
                        label="Cybrid integration flag"
                        value={String(p.cybrid_integration_completed)}
                      />
                      <DetailItem
                        label="Last login"
                        value={formatSafe(p.last_login_at || p.last_login)}
                      />
                      <DetailItem label="Created" value={formatSafe(p.created_at)} />
                    </dl>
                  ) : null}

                  {tab === "cybrid" ? (
                    <dl>
                      {data.cybrid ? (
                        <>
                          <DetailItem
                            label="Cybrid customer id"
                            value={data.cybrid.cybrid_customer_id}
                            mono
                          />
                          <DetailItem
                            label="Cybrid verification"
                            value={data.cybrid.verification_status}
                          />
                          <DetailItem
                            label="External bank accounts"
                            value={String(data.cybrid.external_bank_accounts_count ?? "—")}
                          />
                          <DetailItem label="KYC state" value={data.cybrid.kyc_state} />
                        </>
                      ) : (
                        <p className="py-4 text-sm text-muted-foreground">
                          No Cybrid mapping for this user.
                        </p>
                      )}
                    </dl>
                  ) : null}

                  {tab === "activity" ? (
                    <div className="py-4 text-sm text-muted-foreground">
                      <p>
                        Search transactions by this user&apos;s email, or use{" "}
                        <span className="font-mono text-foreground">user_id</span> in reporting.
                      </p>
                      <Link
                        href="/transactions"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
                      >
                        Open transactions
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-border bg-surface-muted/40 px-5 py-4">
                  <Link
                    href="/transfers"
                    className={cn(buttonVariants(), "inline-flex w-full justify-center sm:w-auto")}
                  >
                    Open transfers
                  </Link>
                </div>
              </>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
