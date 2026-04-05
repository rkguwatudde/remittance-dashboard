"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CircleEllipsis,
  Loader2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  string,
  { variant: "default" | "success" | "warning" | "destructive" | "secondary"; label: string; hint: string }
> = {
  SENDING: {
    variant: "default",
    label: "Sending",
    hint: "Provider call in progress or queued; row may update shortly.",
  },
  SENT: {
    variant: "success",
    label: "Sent",
    hint: "SMS accepted by provider; idempotent key prevents duplicates.",
  },
  FAILED: {
    variant: "destructive",
    label: "Failed",
    hint: "Provider or transport error; inspect last_error and provider_response.",
  },
  SKIPPED_INVALID_PHONE: {
    variant: "secondary",
    label: "Invalid phone",
    hint: "Number could not be normalized; no provider call was made.",
  },
};

export function NotificationStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toUpperCase();
  const meta = STATUS_META[key] ?? {
    variant: "secondary" as const,
    label: status,
    hint: "Unknown status",
  };

  const icon = (() => {
    if (key === "SENDING") {
      return <Loader2 className="size-3.5 animate-spin opacity-90" aria-hidden />;
    }
    if (key === "SENT") {
      return <Check className="size-3.5 opacity-90" aria-hidden />;
    }
    if (key === "FAILED") {
      return <XCircle className="size-3.5 opacity-90" aria-hidden />;
    }
    if (key === "SKIPPED_INVALID_PHONE") {
      return <AlertTriangle className="size-3.5 opacity-90" aria-hidden />;
    }
    return <CircleEllipsis className="size-3.5 opacity-80" aria-hidden />;
  })();

  return (
    <Badge
      variant={meta.variant}
      className={cn("gap-1.5 pr-2.5 font-medium tabular-nums", className)}
      title={meta.hint}
    >
      {icon}
      {meta.label}
    </Badge>
  );
}
