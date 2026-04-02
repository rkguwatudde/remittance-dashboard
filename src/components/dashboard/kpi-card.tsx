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
};

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  trend = "neutral",
  icon: Icon,
  accent = "default",
}: KPICardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-[var(--shadow-floating)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
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
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
