"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Building2, MoreHorizontal, Pencil, Send, Smartphone } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { AdminSavedRecipientRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { RecipientStatusBadge } from "./recipient-status-badge";
import {
  countryFlagEmoji,
  isRecentUse,
  maskAccountNumber,
  relativeLastUsed,
} from "./recipient-utils";

const CELL = "px-3 py-1.5 align-middle text-xs leading-tight";

export type RecipientRowProps = {
  row: AdminSavedRecipientRow;
  frequentMinSends: number;
  onEdit: (row: AdminSavedRecipientRow) => void;
  onDisable: (row: AdminSavedRecipientRow) => void;
  onMore: (row: AdminSavedRecipientRow) => void;
};

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RecipientRow({
  row,
  frequentMinSends,
  onEdit,
  onDisable,
  onMore,
}: RecipientRowProps) {
  const isMm = row.transfer_type === "mobile_money";
  const recent = isRecentUse(row.last_used_at, 48);
  const frequent = row.send_count >= frequentMinSends && row.is_active;

  return (
    <tr
      className={cn(
        "group border-b border-border/60 transition-colors hover:bg-surface-muted/35",
        recent && row.is_active && "bg-primary-muted/15",
        !row.is_active && "opacity-70",
      )}
    >
      <td className={cn(CELL, "max-w-[220px]")}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-medium text-foreground">{row.recipient_name}</span>
            {frequent ? (
              <Tag className="bg-primary-muted/80 text-primary">Freq</Tag>
            ) : null}
            {recent && row.is_active ? (
              <Tag className="bg-surface-muted text-muted-foreground">New</Tag>
            ) : null}
          </div>
          {row.customer_email ? (
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {row.customer_email}
            </span>
          ) : null}
        </div>
      </td>
      <td className={CELL}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {isMm ? (
            <Smartphone className="size-3 shrink-0 text-primary" aria-hidden />
          ) : (
            <Building2 className="size-3 shrink-0 text-primary" aria-hidden />
          )}
          <span className="whitespace-nowrap text-foreground">{isMm ? "Mobile" : "Bank"}</span>
        </div>
      </td>
      <td className={cn(CELL, "font-mono text-[11px] text-muted-foreground")}>
        {isMm ? row.phone_number ?? "—" : "—"}
      </td>
      <td className={cn(CELL, "max-w-[140px] truncate text-foreground")}>
        {!isMm ? row.bank_name ?? "—" : "—"}
      </td>
      <td className={cn(CELL, "font-mono text-[11px] text-muted-foreground")}>
        {!isMm ? maskAccountNumber(row.account_number) : "—"}
      </td>
      <td className={CELL} title={row.country_code ?? ""}>
        <span className="text-sm leading-none">{countryFlagEmoji(row.country_code)}</span>
        <span className="sr-only">{row.country_code ?? ""}</span>
      </td>
      <td className={cn(CELL, "text-muted-foreground")}>{isMm ? row.network ?? "—" : "—"}</td>
      <td className={cn(CELL, "tabular-nums font-medium text-foreground")}>
        {row.send_count.toLocaleString()}
      </td>
      <td className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
        {relativeLastUsed(row.last_used_at)}
      </td>
      <td className={CELL}>
        <RecipientStatusBadge active={row.is_active} compact />
      </td>
      <td className={CELL}>
        <div className="flex items-center justify-end gap-0.5">
          <div className="flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <Link
              href={`/transfer?tab=send&recipient=${encodeURIComponent(row.id)}`}
              prefetch={false}
              className={cn(buttonVariants({ variant: "secondary", size: "icon" }), "size-7 rounded-md")}
              title="Send"
            >
              <Send className="size-3.5" />
              <span className="sr-only">Send</span>
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-7 rounded-md"
              title="Edit"
              onClick={() => onEdit(row)}
            >
              <Pencil className="size-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
            {row.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-warning hover:text-warning"
                title="Disable"
                onClick={() => onDisable(row)}
              >
                <Ban className="size-3.5" />
                <span className="sr-only">Disable</span>
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-md"
            aria-label="More"
            onClick={() => onMore(row)}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
