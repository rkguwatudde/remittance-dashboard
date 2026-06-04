"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { isSuperAdmin } from "@/lib/admin-roles";

export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return isSuperAdmin(user?.role);
}
