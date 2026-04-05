"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { AdminSavedRecipientRow } from "@/lib/remittance-admin-api";

import { RecipientRow } from "./recipient-row";

type RecipientTableProps = {
  loading: boolean;
  rows: AdminSavedRecipientRow[];
  frequentMinSends: number;
  onEdit: (row: AdminSavedRecipientRow) => void;
  onDisable: (row: AdminSavedRecipientRow) => void;
  onMore: (row: AdminSavedRecipientRow) => void;
};

const N_COL = 11;

export function RecipientTable({
  loading,
  rows,
  frequentMinSends,
  onEdit,
  onDisable,
  onMore,
}: RecipientTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Bank</th>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Country</th>
            <th className="px-4 py-3 font-medium">Network</th>
            <th className="px-4 py-3 font-medium">Sends</th>
            <th className="px-4 py-3 font-medium">Last used</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  {Array.from({ length: N_COL }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[7rem]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <RecipientRow
                  key={row.id}
                  row={row}
                  frequentMinSends={frequentMinSends}
                  onEdit={onEdit}
                  onDisable={onDisable}
                  onMore={onMore}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}
