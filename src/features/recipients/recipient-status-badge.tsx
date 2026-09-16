"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function RecipientStatusBadge({
  active,
  compact = false,
}: {
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Badge
      variant={active ? "success" : "secondary"}
      className={cn(
        "font-medium",
        compact && "h-5 rounded px-1.5 py-0 text-[10px] leading-none",
        !active && "opacity-90",
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
