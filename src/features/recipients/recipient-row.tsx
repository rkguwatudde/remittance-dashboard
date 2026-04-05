"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Building2, MoreHorizontal, Pencil, Send, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

export type RecipientRowProps = {
  row: AdminSavedRecipientRow;
  frequentMinSends: number;
  onEdit: (row: AdminSavedRecipientRow) => void;
  onDisable: (row: AdminSavedRecipientRow) => void;
  onMore: (row: AdminSavedRecipientRow) => void;
};

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
        "group relative border-b border-border/70 transition-colors",
        recent && row.is_active && "bg-primary-muted/25",
        !row.is_active && "opacity-75",
      )}
    >
      <td className="px-4 py-4 align-middle">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{row.recipient_name}</span>
          <span className="text-[11px] text-muted-foreground">{row.customer_email ?? "—"}</span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {frequent ? (
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                Frequent
              </Badge>
            ) : null}
            {recent && row.is_active ? (
              <Badge variant="secondary" className="text-[10px]">
                Recent
              </Badge>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-2 text-sm text-foreground">
          {isMm ? (
            <Smartphone className="size-4 shrink-0 text-primary" />
          ) : (
            <Building2 className="size-4 shrink-0 text-primary" />
          )}
          {isMm ? "Mobile money" : "Bank"}
        </div>
      </td>
      <td className="px-4 py-4 align-middle font-mono text-sm text-muted-foreground">
        {isMm ? row.phone_number ?? "—" : "—"}
      </td>
      <td className="px-4 py-4 align-middle text-sm text-foreground">
        {!isMm ? row.bank_name ?? "—" : "—"}
      </td>
      <td className="px-4 py-4 align-middle font-mono text-sm text-muted-foreground">
        {!isMm ? maskAccountNumber(row.account_number) : "—"}
      </td>
      <td className="px-4 py-4 align-middle text-lg" title={row.country_code ?? ""}>
        {countryFlagEmoji(row.country_code)}
        <span className="sr-only">{row.country_code ?? ""}</span>
      </td>
      <td className="px-4 py-4 align-middle text-sm text-muted-foreground">
        {isMm ? row.network ?? "—" : "—"}
      </td>
      <td className="px-4 py-4 align-middle tabular-nums text-sm font-medium text-foreground">
        {row.send_count.toLocaleString()}
      </td>
      <td className="px-4 py-4 align-middle text-sm text-muted-foreground whitespace-nowrap">
        {relativeLastUsed(row.last_used_at)}
      </td>
      <td className="px-4 py-4 align-middle">
        <RecipientStatusBadge active={row.is_active} />
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <Link
              href={`/send?recipient=${encodeURIComponent(row.id)}`}
              prefetch={false}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "h-8 rounded-lg px-2 text-xs no-underline",
              )}
            >
              <Send className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Send</span>
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg px-2 text-xs"
              onClick={() => onEdit(row)}
            >
              <Pencil className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            {row.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs text-warning"
                onClick={() => onDisable(row)}
              >
                <Ban className="size-3.5" />
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="More"
            onClick={() => onMore(row)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
