"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { canManageCustomers } from "@/lib/admin-roles";

export function useCanManageCustomers(): boolean {
  const { user } = useAuth();
  return canManageCustomers(user?.role);
}
