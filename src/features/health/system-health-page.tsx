"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CHART_PRIMARY = "oklch(0.48 0.19 264)";
const CHART_ACCENT = "oklch(0.72 0.14 232)";
const CHART_GRID = "oklch(0.55 0.02 264 / 0.35)";

const latencyData = [
  { time: "10:00", api: 120, db: 45 },
  { time: "10:05", api: 135, db: 50 },
  { time: "10:10", api: 110, db: 42 },
  { time: "10:15", api: 150, db: 55 },
  { time: "10:20", api: 125, db: 48 },
  { time: "10:25", api: 115, db: 44 },
  { time: "10:30", api: 140, db: 52 },
];

export function SystemHealthPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Rails &amp; health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Partner latencies, infra signals, and recent change events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" className="gap-2 font-mono text-[10px] uppercase">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            All systems operational
          </Badge>
          <Button variant="secondary" size="icon" aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "API gateway", status: "Operational", icon: Globe, ok: true },
          { label: "Ledger DB", status: "Operational", icon: Database, ok: true },
          { label: "Payment engine", status: "Optimal", icon: ShieldCheck, ok: true },
          { label: "Auth / SSO", status: "Operational", icon: Server, ok: true },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  item.ok
                    ? "bg-success-muted text-success"
                    : "bg-warning-muted text-warning",
                )}
              >
                <item.icon className="size-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {item.status}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-5 text-primary" />
              Core latency (ms)
            </CardTitle>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                API
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" />
                DB
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData}>
                <defs>
                  <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={CHART_GRID}
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 264)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 264)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid oklch(0.88 0.01 264)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="api"
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorApi)"
                />
                <Area
                  type="monotone"
                  dataKey="db"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-primary" />
              Recent events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              {
                time: "2 min ago",
                event: "Reconciliation job BB-REC-09 completed",
                type: "success" as const,
                icon: CheckCircle2,
              },
              {
                time: "15 min ago",
                event: "API autoscale → 4 instances (us-east-1)",
                type: "info" as const,
                icon: Cpu,
              },
              {
                time: "45 min ago",
                event: "Elevated latency — MTO partner B",
                type: "warning" as const,
                icon: AlertTriangle,
              },
              {
                time: "2 h ago",
                event: "Security patch deployed (v2.4.1)",
                type: "success" as const,
                icon: ShieldCheck,
              },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    item.type === "success" && "bg-success-muted text-success",
                    item.type === "info" && "bg-info-muted text-info",
                    item.type === "warning" && "bg-warning-muted text-warning",
                  )}
                >
                  <item.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {item.event}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
