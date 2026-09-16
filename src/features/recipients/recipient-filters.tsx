"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type RecipientTab = "all" | "mobile_money" | "bank" | "frequent";

const TABS: { id: RecipientTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mobile_money", label: "Mobile money" },
  { id: "bank", label: "Bank accounts" },
  { id: "frequent", label: "Frequently used" },
];

const COUNTRIES = [
  { code: "", label: "All countries" },
  { code: "UG", label: "Uganda" },
  { code: "KE", label: "Kenya" },
  { code: "RW", label: "Rwanda" },
  { code: "TZ", label: "Tanzania" },
];

type RecipientFiltersProps = {
  tab: RecipientTab;
  onTab: (t: RecipientTab) => void;
  countryCode: string;
  onCountry: (c: string) => void;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
};

export function RecipientFilters({
  tab,
  onTab,
  countryCode,
  onCountry,
  showInactive,
  onShowInactive,
}: RecipientFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-0.5 rounded-lg border border-border/80 bg-surface-muted/40 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:text-sm sm:px-3 sm:py-2",
              tab === t.id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Country</span>
          <select
            value={countryCode}
            onChange={(e) => onCountry(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground shadow-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code || "all"} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => onShowInactive(e.target.checked)}
            className="rounded border-border"
          />
          Include inactive
        </label>
      </div>
    </div>
  );
}
