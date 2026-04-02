"use client";
import { Clock3, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const rows = [
  {
    id: "EX-2041",
    corridor: "USD → KES",
    amount: "$1,250",
    reason: "Velocity — sender tier M2 threshold",
    age: "6m",
    owner: "Unassigned",
    severity: "high" as const,
  },
  {
    id: "EX-2038",
    corridor: "EUR → GHS",
    amount: "€900",
    reason: "Beneficiary name fuzzy match (92%)",
    age: "22m",
    owner: "L. Mensah",
    severity: "medium" as const,
  },
  {
    id: "EX-2035",
    corridor: "GBP → NGN",
    amount: "£2,100",
    reason: "Partner timeout — retry 2/3",
    age: "41m",
    owner: "Queue",
    severity: "low" as const,
  },
  {
    id: "EX-2029",
    corridor: "USD → NGN",
    amount: "$500",
    reason: "OFAC secondary screening",
    age: "1h 12m",
    owner: "Compliance",
    severity: "high" as const,
  },
];

export function QueuePage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Exception queue
            </h1>
            <Badge variant="warning" className="font-mono text-[10px]">
              {rows.length} open
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-[15px]">
            Manual interventions surfaced by policy engine, fraud scores, and
            partner errors. Actions are audited.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm">
            Bulk assign
          </Button>
          <Button size="sm">Export for compliance</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border pb-4">
          <ShieldAlert className="size-5 text-warning" />
          <CardTitle className="text-base">Active cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Case</th>
                  <th className="px-6 py-3">Corridor</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Summary</th>
                  <th className="px-6 py-3">Owner</th>
                  <th className="px-6 py-3">Age</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-surface-muted/40"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-foreground">
                      {row.id}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {row.corridor}
                    </td>
                    <td className="px-6 py-4 font-medium tabular-nums text-foreground">
                      {row.amount}
                    </td>
                    <td className="max-w-[280px] px-6 py-4 text-muted-foreground">
                      {row.reason}
                    </td>
                    <td className="px-6 py-4 text-foreground">{row.owner}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        {row.age}
                      </span>
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
