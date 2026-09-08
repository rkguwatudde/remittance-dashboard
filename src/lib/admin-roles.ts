export const SUPER_ADMIN_ROLE = "SUPER_ADMIN" as const;
export const OPERATIONS_ADMIN_ROLE = "OPERATIONS_ADMIN" as const;

export function normalizeStaffRole(role: string | undefined | null): string {
  return String(role || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return normalizeStaffRole(role) === SUPER_ADMIN_ROLE;
}

/** SUPER_ADMIN and OPERATIONS_ADMIN may lock/unlock customer accounts. */
export function canManageCustomers(role: string | undefined | null): boolean {
  const normalized = normalizeStaffRole(role);
  return normalized === SUPER_ADMIN_ROLE || normalized === OPERATIONS_ADMIN_ROLE;
}
