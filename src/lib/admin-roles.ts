export const SUPER_ADMIN_ROLE = "SUPER_ADMIN" as const;

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}
