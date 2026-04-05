"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type RecipientSearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function RecipientSearchBar({
  value,
  onChange,
  placeholder = "Search name, phone, or account…",
}: RecipientSearchBarProps) {
  return (
    <div className="relative min-w-0 flex-1 max-w-xl">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-border/80 bg-surface pl-10 pr-3 shadow-sm transition-shadow focus-visible:shadow-md"
        autoComplete="off"
      />
    </div>
  );
}
