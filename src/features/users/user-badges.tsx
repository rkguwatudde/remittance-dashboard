"use client";

import { cn } from "@/lib/utils";

export function UserStatusBadge({
  isVerified,
  isActive,
}: {
  isVerified: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
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
      <span className="inline-flex rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Segment unknown
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
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
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
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
