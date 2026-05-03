"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/queue", label: "Exceptions", icon: ShieldCheck },
  { href: "/transfer?tab=send", label: "Transfers", icon: Send },
  { href: "/users", label: "Users", icon: UserCircle2 },
  { href: "/transactions", label: "Transactions", icon: History },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/recipients", label: "Recipients", icon: Users },
  { href: "/system", label: "System & admin", icon: Activity },
] as const;

const secondaryNav = [
  { href: "/support", label: "Support", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type AppSidebarProps = {
  mobileOpen?: boolean;
  onNavigate?: () => void;
};

export function AppSidebar({ mobileOpen = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();

  const path = pathname ?? "";
  const isActive = (href: string) => {
    if (href === "/") return path === "/";
    const base = href.split("?")[0] ?? href;
    return path === base || path.startsWith(`${base}/`);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-dvh w-60 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
          BB
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-foreground">
            BoraBond
          </p>
          <p className="text-xs text-muted-foreground">Operations</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary-muted text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0 opacity-80" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-4">
        {user ? (
          <div className="mb-3 rounded-lg border border-border bg-surface-muted/50 px-3 py-2">
            <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.displayRole}</p>
          </div>
        ) : null}
        {secondaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            void (async () => {
              await signOut();
              onNavigate?.();
              router.replace("/login");
            })();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-muted"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
);
}
