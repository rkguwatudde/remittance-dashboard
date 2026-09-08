"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { SuperAdminRouteGuard } from "@/components/dashboard/super-admin-route-guard";
import { useAuth } from "@/components/providers/auth-provider";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isReady, passwordResetRequired } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const onChangePasswordPage = pathname === "/change-password";

  React.useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (passwordResetRequired && !onChangePasswordPage) {
      router.replace("/change-password");
    }
  }, [user, isReady, passwordResetRequired, onChangePasswordPage, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Loading console…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (passwordResetRequired && onChangePasswordPage) {
    return <div className="min-h-dvh bg-background">{children}</div>;
  }

  if (passwordResetRequired) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-background">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <AppSidebar
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <div className="md:pl-60">
        <AppTopbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="px-4 py-4 md:px-6 md:py-5">
          <SuperAdminRouteGuard>{children}</SuperAdminRouteGuard>
        </main>
      </div>
    </div>
  );
}
