"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  MoreHorizontal,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Users,
  Globe2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Transaction } from "@/types";
import { cn } from "@/lib/utils";

const CHART_PRIMARY = "oklch(0.48 0.19 264)";
const CHART_ACCENT = "oklch(0.72 0.14 232)";
const CHART_GRID = "oklch(0.91 0.01 264 / 0.6)";

const volumeByMonth = [
  { name: "Jan", value: 4_500_000 },
  { name: "Feb", value: 3_200_000 },
  { name: "Mar", value: 5_800_000 },
  { name: "Apr", value: 4_100_000 },
  { name: "May", value: 6_200_000 },
  { name: "Jun", value: 7_500_000 },
];

const statusMix = [
  { name: "Settled", value: 86, color: CHART_PRIMARY },
  { name: "In flight", value: 9, color: CHART_ACCENT },
  { name: "Needs review", value: 5, color: "oklch(0.55 0.2 25)" },
];

const recentTransactions: Transaction[] = [
  {
    id: "bb_tx_8j3k",
    amount: 1250,
    currency: "USD",
    recipient: "Alice Johnson",
    date: "2026-03-28",
    status: "completed",
    type: "send",
  },
  {
    id: "bb_tx_9m1p",
    amount: 450,
    currency: "EUR",
    recipient: "Bob Smith",
    date: "2026-03-27",
    status: "pending",
    type: "send",
  },
  {
    id: "bb_tx_2n7q",
    amount: 2100,
    currency: "GBP",
    recipient: "Charlie Brown",
    date: "2026-03-26",
    status: "completed",
    type: "send",
  },
  {
    id: "bb_tx_4k8r",
    amount: 80,
    currency: "USD",
    recipient: "David Wilson",
    date: "2026-03-25",
    status: "failed",
    type: "send",
  },
  {
    id: "bb_tx_1s5t",
    amount: 500,
    currency: "USD",
    recipient: "Eve Davis",
    date: "2026-03-24",
    status: "processing",
    type: "send",
  },
];

const exceptionQueue = [
  {
    id: "EX-2041",
    corridor: "USD → KES",
    reason: "Velocity check — sender tier M2",
    age: "6m",
    severity: "high" as const,
  },
  {
    id: "EX-2038",
    corridor: "EUR → GHS",
    reason: "Beneficiary name fuzzy match",
    age: "22m",
    severity: "medium" as const,
  },
  {
    id: "EX-2035",
    corridor: "GBP → NGN",
    reason: "Partner timeout — retry scheduled",
    age: "41m",
    severity: "low" as const,
  },
];

const corridors = [
  { pair: "USD → KES", spread: "1.12%", latency: "1.8s", health: "ok" as const },
  { pair: "USD → NGN", spread: "1.40%", latency: "2.4s", health: "ok" as const },
  {
    pair: "EUR → GHS",
    spread: "0.98%",
    latency: "3.1s",
    health: "degraded" as const,
  },
];

export function DashboardHome() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Operations overview
            </h1>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              Live
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-[15px]">
            Settlement health, corridor performance, and the manual review queue
            for BoraBond rails. Triage exceptions before they hit SLA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="gap-2">
            <Search className="size-4" />
            Advanced search
          </Button>
          <Link
            href="/send"
            className={cn(buttonVariants({ size: "sm" }), "gap-2 no-underline")}
          >
            <Plus className="size-4" />
            Execute transfer
          </Link>
        </div>
      </div>

      <Card className="border-primary/15 bg-primary-muted/40">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock3 className="size-4 text-primary" />
              <span>Cutoff &amp; SLA</span>
            </div>
            <Badge variant="success">Partner batch — 14m</Badge>
            <span className="text-sm text-muted-foreground">
              Next ACH pull <span className="font-mono text-foreground">01:12 UTC</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
              <span className="text-muted-foreground">Queue P95</span>
              <span className="font-semibold tabular-nums text-foreground">2.9m</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
              <span className="text-muted-foreground">Open exceptions</span>
              <span className="font-semibold tabular-nums text-warning">12</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 shadow-sm">
              <span className="text-muted-foreground">Today&apos;s volume</span>
              <span className="font-semibold tabular-nums text-foreground">$4.2M</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Float available"
          value="$12.45M"
          subtitle="Across prefund wallets"
          change="2.1% DoD"
          trend="up"
          icon={Wallet}
        />
        <KpiCard
          title="Sent (24h)"
          value="$840K"
          subtitle="Gross off-ramp"
          change="6.4% vs baseline"
          trend="up"
          icon={ArrowUpRight}
        />
        <KpiCard
          title="Active senders"
          value="1,284"
          subtitle="Unique KYC-approved"
          change="18 new"
          trend="neutral"
          icon={Users}
        />
        <KpiCard
          title="Settlement success"
          value="99.2%"
          subtitle="Partner callbacks OK"
          change="Within SLO"
          trend="up"
          icon={TrendingUp}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-2">
            <div>
              <CardTitle>Gross send volume</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Normalized to USD · last 6 months
              </p>
            </div>
            <select className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm">
              <option>Last 6 months</option>
              <option>FY to date</option>
            </select>
          </CardHeader>
          <CardContent className="h-[320px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeByMonth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={CHART_GRID}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "oklch(0.48 0.02 264)", fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "oklch(0.48 0.02 264)", fontSize: 12 }}
                  tickFormatter={(v) =>
                    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${v}`
                  }
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.48 0.19 264 / 0.06)" }}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })
                      : String(value ?? "")
                  }
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid oklch(0.91 0.01 264)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={CHART_PRIMARY}
                  radius={[6, 6, 0, 0]}
                  barSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payment state mix</CardTitle>
            <p className="text-sm text-muted-foreground">Today · all corridors</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusMix}
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {statusMix.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">94%</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Clean settlement
                </span>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {statusMix.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {s.value}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" />
              <CardTitle>Corridor pulse</CardTitle>
            </div>
            <Link
              href="/health"
              className="text-sm font-medium text-primary hover:underline"
            >
              Rails detail
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {corridors.map((c) => (
              <div
                key={c.pair}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{c.pair}</p>
                  <p className="text-xs text-muted-foreground">
                    FX spread · <span className="font-mono">{c.spread}</span> ·
                    median ack{" "}
                    <span className="font-mono text-foreground">{c.latency}</span>
                  </p>
                </div>
                <Badge
                  variant={c.health === "ok" ? "success" : "warning"}
                  className="capitalize"
                >
                  {c.health}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <CardTitle>Exception queue</CardTitle>
            </div>
            <Link
              href="/queue"
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-medium shadow-sm transition-colors hover:bg-surface-muted",
              )}
            >
              Open queue
            </Link>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {exceptionQueue.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {row.id}
                    </span>
                    <Badge
                      variant={
                        row.severity === "high"
                          ? "destructive"
                          : row.severity === "medium"
                            ? "warning"
                            : "secondary"
                      }
                      className="text-[10px] uppercase"
                    >
                      {row.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{row.reason}</p>
                  <p className="text-xs text-muted-foreground">{row.corridor}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {row.age}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-muted/30 pb-4">
          <div>
            <CardTitle>Recent transfers</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest customer-visible states — drill into ledger in Transactions.
            </p>
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Recipient</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="group transition-colors hover:bg-surface-muted/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground">
                        {tx.recipient
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tx.recipient}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {tx.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold tabular-nums text-foreground">
                    {tx.amount.toLocaleString("en-US", {
                      style: "currency",
                      currency: tx.currency,
                    })}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "status-badge",
                        tx.status === "completed" && "status-completed",
                        tx.status === "pending" && "status-pending",
                        tx.status === "failed" && "status-failed",
                        tx.status === "processing" && "status-processing",
                      )}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="font-medium text-foreground">End-of-day checklist</p>
              <p className="text-sm text-muted-foreground">
                Confirm partner reconciliations and lock FX marks before treasury
                handoff.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm">
            Run reconciliation snapshot
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
