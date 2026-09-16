"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { TransactionsPage } from "@/features/transactions/transactions-page";

import { BusinessPartnerKpiCards } from "./business-partner-kpi-cards";
import { BusinessPartnersDirectory } from "./business-partners-directory";

const TABS = [
  { id: "partners", label: "Partners" },
  { id: "payouts", label: "Payout history" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BusinessPartnersPage() {
  const [tab, setTab] = React.useState<TabId>("partners");
  const [statsRefreshKey, setStatsRefreshKey] = React.useState(0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Business Partner</h1>

      <BusinessPartnerKpiCards refreshKey={statsRefreshKey} />

      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "payouts") setStatsRefreshKey((k) => k + 1);
            }}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
            )}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "partners" ? <BusinessPartnersDirectory /> : null}
      {tab === "payouts" ? <TransactionsPage scope="business" embedded /> : null}
    </div>
  );
}
