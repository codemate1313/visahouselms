import type { DirectoryRole, DirectoryUser } from "@/api/types";

/**
 * Per-role API surface for the directory's row actions.
 *
 * Super admins and SA instructors are platform-wide and have their own
 * management endpoints, so the directory can act on them directly. Institute
 * admins, staff and students are tenant-scoped and are managed from their
 * institute's own accounts screen, so those rows only offer a link out - that
 * keeps institute membership rules in one place rather than duplicated here.
 */
interface RoleActions {
  /** Base path for deactivate/reactivate/delete. */
  base: string;
  /** Route to the role's edit form. */
  editPath: (user: DirectoryUser) => string;
  /** Whether the role supports toggling force_password_reset in place. */
  supportsForceReset: boolean;
  /** Whether the role supports issuing a new temporary password. */
  supportsPasswordReset: boolean;
}

export const ROLE_ACTIONS: Partial<Record<DirectoryRole, RoleActions>> = {
  SUPER_ADMIN: {
    base: "/super-admin/accounts",
    editPath: (user) => `/super-admin/accounts/${user.id}`,
    supportsForceReset: true,
    supportsPasswordReset: false,
  },
  SA_INSTRUCTOR: {
    base: "/super-admin/instructors",
    editPath: (user) => `/super-admin/instructors/${user.id}`,
    supportsForceReset: false,
    supportsPasswordReset: true,
  },
};

/** Read-only destination for tenant-scoped roles, or null when unresolvable. */
export function tenantManageLink(user: DirectoryUser): string | null {
  if (!user.institute_id) return null;
  if (user.role_name === "STUDENT") {
    return `/super-admin/institutes/${user.institute_id}/accounts/students/${user.id}`;
  }
  return `/super-admin/institutes/${user.institute_id}/accounts`;
}

export function isProtected(user: DirectoryUser): boolean {
  return user.is_owner;
}
