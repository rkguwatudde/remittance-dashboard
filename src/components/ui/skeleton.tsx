import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Block placeholder with optional directional shimmer (reduced-motion safe).
 */
export function Skeleton({
  className,
  shimmer = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md",
        shimmer
          ? "skeleton-shine bg-surface-muted"
          : "animate-pulse bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
