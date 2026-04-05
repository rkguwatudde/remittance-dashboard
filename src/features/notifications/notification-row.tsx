"use client";

import * as React from "react";
import { Eye, Loader2, RotateCcw } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import type { AdminSmsNotificationLogRow } from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

import { NotificationStatusBadge } from "./notification-status-badge";
import { formatSmsPhoneDisplay, truncateMessage } from "./notification-utils";

export type NotificationRowProps = {
  row: AdminSmsNotificationLogRow;
  onOpen: (row: AdminSmsNotificationLogRow) => void;
  onRetry: (row: AdminSmsNotificationLogRow) => void;
  retrying: boolean;
};

export function NotificationRow({ row, onOpen, onRetry, retrying }: NotificationRowProps) {
  const st = row.status.toUpperCase();
  const canRetry = st !== "SENT" && Boolean(row.remittance_transaction_id?.trim());
  const sending = st === "SENDING";
  const failed = st === "FAILED";

  return (
    <tr
      className={cn(
        "border-b border-border/80 transition-colors",
        sending && "border-l-[3px] border-l-primary bg-primary-muted/15",
        failed && "bg-danger-muted/20 hover:bg-danger-muted/25",
        !failed && !sending && "hover:bg-surface-muted/50",
      )}
    >
      <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-muted-foreground">
        <span className="font-mono text-[11px] text-foreground">
          {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
        </span>
        <div className="mt-0.5 text-[10px] opacity-80">upd {format(new Date(row.updated_at), "HH:mm:ss")}</div>
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-xs text-foreground">
        {formatSmsPhoneDisplay(row.phone_number)}
      </td>
      <td className="max-w-[220px] px-3 py-2.5 align-top text-sm text-foreground" title={row.message}>
        {truncateMessage(row.message, 96)}
      </td>
      <td className="px-3 py-2.5 align-top">
        <NotificationStatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-xs tabular-nums text-foreground">
        {row.attempts}
      </td>
      <td className="max-w-[140px] px-3 py-2.5 align-top font-mono text-[11px] text-foreground">
        {row.remittance_transaction_id?.trim() ? (
          <span className="break-all" title={row.remittance_transaction_id}>
            {row.remittance_transaction_id.length > 18
              ? `…${row.remittance_transaction_id.slice(-14)}`
              : row.remittance_transaction_id}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {row.sibling_logs_for_same_tx > 0 ? (
          <div
            className="mt-1 text-[10px] font-medium text-warning"
            title="Multiple SMS log rows share this transaction id (separate dedupe keys)"
          >
            +{row.sibling_logs_for_same_tx} related
          </div>
        ) : null}
      </td>
      <td className="max-w-[180px] px-3 py-2.5 align-top text-xs text-danger" title={row.last_error ?? undefined}>
        {st === "FAILED" && row.last_error ? (
          <span className="line-clamp-2 break-words">{row.last_error}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => onOpen(row)}
          >
            <Eye className="size-3.5" />
            Details
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            disabled={!canRetry || retrying}
            onClick={() => onRetry(row)}
            title={
              !canRetry
                ? st === "SENT"
                  ? "Already sent"
                  : "Missing transaction id"
                : "Re-queue SMS for linked remittance"
            }
          >
            {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            Retry
          </Button>
        </div>
      </td>
    </tr>
  );
}
