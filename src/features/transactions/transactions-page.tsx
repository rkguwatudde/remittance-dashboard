"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Filter,
  MoreVertical,
  RefreshCcw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Transaction } from "@/types";
import { cn } from "@/lib/utils";

const transactions: Transaction[] = [
  {
    id: "1",
    amount: 1250,
    currency: "USD",
    recipient: "Alice Johnson",
    date: "2026-03-28 14:30",
    status: "completed",
    type: "send",
  },
  {
    id: "2",
    amount: 450,
    currency: "EUR",
    recipient: "Bob Smith",
    date: "2026-03-27 09:15",
    status: "pending",
    type: "send",
  },
  {
    id: "3",
    amount: 2100,
    currency: "GBP",
    recipient: "Charlie Brown",
    date: "2026-03-26 18:45",
    status: "completed",
    type: "send",
  },
  {
    id: "4",
    amount: 80,
    currency: "USD",
    recipient: "David Wilson",
    date: "2026-03-25 11:20",
    status: "failed",
    type: "send",
  },
  {
    id: "5",
    amount: 500,
    currency: "USD",
    recipient: "Eve Davis",
    date: "2026-03-24 16:00",
    status: "processing",
    type: "send",
  },
  {
    id: "6",
    amount: 3000,
    currency: "USD",
    recipient: "Frank Miller",
    date: "2026-03-23 10:30",
    status: "completed",
    type: "send",
  },
  {
    id: "7",
    amount: 150,
    currency: "USD",
    recipient: "Grace Lee",
    date: "2026-03-22 13:15",
    status: "completed",
    type: "send",
  },
  {
    id: "8",
    amount: 900,
    currency: "EUR",
    recipient: "Henry Ford",
    date: "2026-03-21 15:45",
    status: "pending",
    type: "send",
  },
];

export function TransactionsPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Unified ledger view across partner callbacks and internal states.
          </p>
        </div>
        <Button variant="secondary" className="gap-2">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Recipient, BB ID, partner ref…"
              className="h-10 border-transparent bg-surface-muted pl-9 focus-visible:bg-surface"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="gap-2">
              <Filter className="size-4" />
              Filters
            </Button>
            <Button variant="secondary" size="sm" className="gap-2">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4">Transaction</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="group transition-colors hover:bg-surface-muted/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl",
                          tx.type === "send"
                            ? "bg-danger-muted text-danger"
                            : "bg-success-muted text-success",
                        )}
                      >
                        {tx.type === "send" ? (
                          <ArrowUpRight className="size-5" />
                        ) : (
                          <ArrowDownLeft className="size-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          #{tx.id}0482
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {tx.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold">
                        {tx.recipient
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="font-medium text-foreground">
                        {tx.recipient}
                      </span>
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
                      className="opacity-0 group-hover:opacity-100"
                      aria-label="Row actions"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">8</span> of{" "}
            <span className="font-semibold text-foreground">124</span> results
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled>
              Previous
            </Button>
            <Button variant="secondary" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
