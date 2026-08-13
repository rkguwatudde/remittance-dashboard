import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KPICardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  accent?: "default" | "success";
  /** Native tooltip — use for compact values that hide the exact figure. */
  valueTitle?: string;
};

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  trend = "neutral",
  icon: Icon,
  accent = "default",
  valueTitle,
}: KPICardProps) {
  const tooltip = valueTitle ?? (typeof value === "string" ? value : undefined);

  return (
    <Card className="@container min-w-0 overflow-hidden transition-shadow hover:shadow-[var(--shadow-floating)]">
      <CardContent className="min-w-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              accent === "success"
                ? "bg-success-muted text-success"
                : "bg-primary-muted text-primary",
            )}
          >
            <Icon className="size-5" />
          </div>
          {change ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                trend === "up" && "bg-success-muted text-success",
                trend === "down" && "bg-danger-muted text-danger",
                trend === "neutral" && "bg-surface-muted text-muted-foreground",
              )}
            >
              {trend === "up" ? "+" : trend === "down" ? "" : ""}
              {change}
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
        <p
          className="mt-1 max-w-full font-semibold leading-[1.15] tracking-tight text-pretty break-words tabular-nums text-foreground text-[clamp(1.05rem,8cqi,1.5rem)]"
          title={tooltip}
        >
          {value}
        </p>
        {subtitle ? (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
