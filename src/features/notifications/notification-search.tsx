"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export type NotificationSearchProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function NotificationSearch({ value, onChange, disabled }: NotificationSearchProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Phone, transaction ID, message body…"
        className="h-10 border-transparent bg-surface-muted pl-9 focus-visible:bg-surface"
      />
    </div>
  );
}
