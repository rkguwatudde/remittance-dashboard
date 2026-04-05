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
