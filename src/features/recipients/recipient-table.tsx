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
  /** When true, table fills parent and scrolls internally (sticky header). */
  fillViewport?: boolean;
};

const N_COL = 11;

export function RecipientTable({
  loading,
  rows,
  frequentMinSends,
  onEdit,
  onDisable,
  onMore,
  fillViewport = false,
}: RecipientTableProps) {
  const shell = fillViewport
    ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-surface shadow-[var(--shadow-card)]"
    : "overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-[var(--shadow-card)]";

  const scroll = fillViewport
    ? "min-h-0 flex-1 overflow-auto overscroll-contain"
    : "overflow-x-auto";

  return (
    <div className={shell}>
      <div className={scroll}>
      <table className="w-full min-w-[1080px] text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-muted/80 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm supports-[backdrop-filter]:bg-surface-muted/70 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-surface-muted/95 [&>th]:shadow-[inset_0_-1px_0_var(--border)]">
            <th className="px-3 py-1.5 font-medium">Recipient</th>
            <th className="px-3 py-1.5 font-medium">Type</th>
            <th className="px-3 py-1.5 font-medium">Phone</th>
            <th className="px-3 py-1.5 font-medium">Bank</th>
            <th className="px-3 py-1.5 font-medium">Account</th>
            <th className="px-3 py-1.5 font-medium">Country</th>
            <th className="px-3 py-1.5 font-medium">Network</th>
            <th className="px-3 py-1.5 font-medium">Sends</th>
            <th className="px-3 py-1.5 font-medium">Last used</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
            <th className="px-3 py-1.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  {Array.from({ length: N_COL }).map((__, j) => (
                    <td key={j} className="px-3 py-1.5">
                      <Skeleton className="h-3 w-full max-w-[6rem]" />
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
    </div>
  );
}
