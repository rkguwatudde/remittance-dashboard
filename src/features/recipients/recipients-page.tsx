"use client";

import * as React from "react";
import {
  Edit2,
  Globe,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Recipient } from "@/types";

const mockRecipients: Recipient[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    phone: "+1 234 567 890",
    avatar: "AJ",
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    phone: "+44 789 012 345",
    avatar: "BS",
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@example.com",
    phone: "+254 712 345 678",
    avatar: "CB",
  },
  {
    id: "4",
    name: "David Wilson",
    email: "david@example.com",
    phone: "+1 987 654 321",
    avatar: "DW",
  },
  {
    id: "5",
    name: "Eve Davis",
    email: "eve@example.com",
    phone: "+49 123 456 789",
    avatar: "ED",
  },
  {
    id: "6",
    name: "Frank Miller",
    email: "frank@example.com",
    phone: "+33 612 345 678",
    avatar: "FM",
  },
];

export function RecipientsPage() {
  const [search, setSearch] = React.useState("");

  const filtered = mockRecipients.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Recipients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            Beneficiary directory with corridor and KYC context (mock data).
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          Add recipient
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 border-transparent bg-surface-muted pl-9 focus-visible:bg-surface"
          />
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => (
          <Card
            key={r.id}
            className="group relative overflow-hidden p-6 transition-shadow hover:shadow-[var(--shadow-floating)]"
          >
            <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreVertical className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-muted text-lg font-semibold text-primary">
                {r.avatar}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">
                  {r.name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Globe className="size-3 shrink-0" />
                  <span>Cross-border</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{r.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="size-4 shrink-0" />
                <span>{r.phone}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" className="gap-1 text-xs">
                <Edit2 className="size-3" />
                Edit
              </Button>
              <Button size="sm" className="gap-1 text-xs">
                <Send className="size-3" />
                Send
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
