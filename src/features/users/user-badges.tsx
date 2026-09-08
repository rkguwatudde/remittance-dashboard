"use client";

import { cn } from "@/lib/utils";

export function UserStatusBadge({
  isVerified,
  isActive,
  isLocked,
}: {
  isVerified: boolean;
  isActive: boolean;
  isLocked?: boolean;
}) {
  return (
    <div className="flex flex-nowrap gap-1">
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
          isVerified
            ? "border-success/40 bg-success-muted text-success"
            : "border-warning/40 bg-warning-muted text-warning",
        )}
      >
        {isVerified ? "Verified" : "Not verified"}
      </span>
      {isLocked ? (
        <span className="inline-flex rounded-md border border-danger/40 bg-danger-muted px-2 py-0.5 text-[10px] font-semibold text-danger">
          Locked
        </span>
      ) : (
        <span
          className={cn(
            "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
            isActive
              ? "border-success/40 bg-success-muted text-success"
              : "border-danger/40 bg-danger-muted text-danger",
          )}
        >
          {isActive ? "Active" : "Disabled"}
        </span>
      )}
    </div>
  );
}

export function CybridLinkStatusBadge({ linked }: { linked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
        linked
          ? "border-info/40 bg-info-muted text-info"
          : "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {linked ? "Cybrid linked" : "Not linked"}
    </span>
  );
}

export type UserProductFields = {
  product_intent?: "send_only" | "send_and_invest" | null;
  account_purpose?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_required?: boolean | null;
};

export type UserProductKind = "send_only" | "invest_ready" | "onboarding" | "unknown";

export function userProductKind(u: UserProductFields): UserProductKind {
  if (u.product_intent === "send_only" || u.account_purpose === "SEND_MONEY_ONLY") {
    return "send_only";
  }
  if (u.onboarding_completed === false) return "onboarding";
  if (u.onboarding_required === false || u.onboarding_completed === true) return "invest_ready";
  return "unknown";
}

/** What the customer can do on the app — not a vendor integration flag. */
export function ProductBadge({ user }: { user: UserProductFields }) {
  const kind = userProductKind(user);
  const copy =
    kind === "send_only"
      ? { label: "Send only", title: "Send money only — investment onboarding is not required" }
      : kind === "invest_ready"
        ? { label: "Send + invest", title: "Onboarding complete, or not required" }
        : kind === "onboarding"
          ? { label: "Onboarding", title: "Investment onboarding is incomplete" }
          : { label: "Unknown", title: "Product intent has not been recorded" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold",
        kind === "send_only" && "border-info/40 bg-info-muted text-info",
        kind === "invest_ready" && "border-success/40 bg-success-muted text-success",
        kind === "onboarding" && "border-warning/40 bg-warning-muted text-warning",
        kind === "unknown" && "border-border bg-surface-muted text-muted-foreground",
      )}
      title={copy.title}
    >
      {copy.label}
    </span>
  );
}

/** Funding-routing segment: NEW = account age < 30 days or < 3 SUCCESS transfers. */
export function CustomerSegmentBadge({
  segment,
  isNew,
}: {
  segment?: "new" | "old" | null;
  isNew?: boolean | null;
}) {
  const isNewCustomer = isNew === true || segment === "new";
  const isOldCustomer = isNew === false || segment === "old";
  if (!isNewCustomer && !isOldCustomer) {
    return (
      <span className="inline-flex shrink-0 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Segment unknown
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
        isNewCustomer
          ? "border-info/40 bg-info-muted text-info"
          : "border-border bg-surface-muted text-muted-foreground",
      )}
      title={
        isNewCustomer
          ? "New: account younger than 30 days or fewer than 3 successful transfers"
          : "Old: account age ≥ 30 days and at least 3 successful transfers"
      }
    >
      {isNewCustomer ? "New" : "Old"}
    </span>
  );
}

export function DeviceBadge({
  device,
  userAgent,
}: {
  device?: "ios" | "android" | "web" | "unknown" | null;
  userAgent?: string | null;
}) {
  const kind = device || "unknown";
  const label =
    kind === "ios" ? "iOS" : kind === "android" ? "Android" : kind === "web" ? "Web" : "Unknown";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
      title={userAgent || undefined}
    >
      {label}
    </span>
  );
}

export function PresenceIndicator({
  online,
  lastSeenAt,
}: {
  online?: boolean;
  lastSeenAt?: string | null;
}) {
  const label = online ? "Online" : "Offline";
  const seen =
    lastSeenAt && !Number.isNaN(new Date(lastSeenAt).getTime())
      ? new Date(lastSeenAt).toISOString().slice(0, 16).replace("T", " ")
      : null;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-muted-foreground"
      title={seen ? `Last seen ${seen} UTC` : "No active session"}
    >
      <span
        className={cn(
          "inline-block size-2 shrink-0 rounded-full",
          online ? "bg-success" : "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      <span className={online ? "text-success" : undefined}>{label}</span>
    </span>
  );
}
