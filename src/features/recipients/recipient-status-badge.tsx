"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function RecipientStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? "success" : "secondary"}
      className={cn("font-medium", !active && "opacity-90")}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
