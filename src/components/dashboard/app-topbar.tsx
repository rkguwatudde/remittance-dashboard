"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { cn } from "@/lib/utils";

type AppTopbarProps = {
  onOpenMobileNav?: () => void;
};

export function AppTopbar({ onOpenMobileNav }: AppTopbarProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-md sm:gap-4 sm:px-4 md:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onOpenMobileNav ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
        ) : null}
        <div className="relative min-w-0 max-w-xl flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by txn ID, sender KYC case, MTO ref…"
          className="h-10 border-transparent bg-surface-muted pl-9 focus-visible:bg-surface"
          autoComplete="off"
        />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Badge variant="secondary" className="hidden font-mono text-[10px] uppercase lg:inline-flex">
          prod · us-east-1
        </Badge>

        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative" aria-label="Alerts">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <button
          type="button"
          className="flex max-w-[220px] items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-muted"
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
            {user?.email
              ? user.email
                  .split("@")[0]!
                  .slice(0, 2)
                  .toUpperCase()
              : "OP"}
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-medium leading-none text-foreground">
              {user?.email
                ? user.email.split("@")[0]!
                : "Operator"}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {user?.displayRole ?? user?.role ?? "Admin"}
            </p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>

        <Link
          href="/transfer?tab=send"
          className={cn(
            buttonVariants({ size: "sm" }),
            "hidden lg:inline-flex no-underline",
          )}
        >
          Execute transfer
        </Link>
      </div>
    </header>
  );
}
