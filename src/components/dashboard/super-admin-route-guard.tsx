"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";

const SUPER_ADMIN_ONLY_PATHS = new Set([
  "/transfer",
  "/send",
  "/book-transfer",
  "/trade-and-transfer",
  "/transfers",
  "/orchestration",
  "/notifications",
  "/recipients",
  "/bank-delete-requests",
]);

function isSuperAdminOnlyPath(pathname: string): boolean {
  if (SUPER_ADMIN_ONLY_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith("/transfer/") ||
    pathname.startsWith("/notifications/") ||
    pathname.startsWith("/recipients/") ||
    pathname.startsWith("/bank-delete-requests/")
  );
}

export function SuperAdminRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { isReady, user } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const blocked = isSuperAdminOnlyPath(pathname);

  React.useEffect(() => {
    if (!isReady || !user || isSuperAdmin || !blocked) return;
    router.replace("/");
  }, [isReady, user, isSuperAdmin, blocked, router]);

  if (!isReady || !user) return children;
  if (!isSuperAdmin && blocked) return null;

  return children;
}
