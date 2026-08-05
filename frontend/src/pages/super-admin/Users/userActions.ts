import type { DirectoryRole, DirectoryUser } from "@/api/types";

/**
 * Per-role API surface for the directory's row actions.
 *
 * Super admins and SA instructors are platform-wide and have their own
 * management endpoints. Institute staff and students are tenant-scoped: the
 * directory acts on them through their own institute's member endpoints, so
 * membership rules stay in one place rather than being duplicated here.
 */
interface RoleActions {
  /** Base path for deactivate/reactivate/delete. */
  base: string;
  /** Route to the role's edit form. */
  editPath: (user: DirectoryUser, basePath?: string) => string;
  /** Whether the role supports toggling force_password_reset in place. */
  supportsForceReset: boolean;
  /** Whether the role supports issuing a new temporary password. */
  supportsPasswordReset: boolean;
}

export const ROLE_ACTIONS: Partial<Record<DirectoryRole, RoleActions>> = {
  SUPER_ADMIN: {
    base: "/super-admin/accounts",
    editPath: (user, basePath = "/super-admin") => `${basePath}/accounts/${user.id}`,
    supportsForceReset: true,
    supportsPasswordReset: false,
  },
  SA_INSTRUCTOR: {
    base: "/super-admin/instructors",
    editPath: (user, basePath = "/super-admin") => `${basePath}/instructors/${user.id}`,
    supportsForceReset: false,
    supportsPasswordReset: true,
  },
};

/**
 * Endpoint that issues a new temporary password, or null when the role has no
 * directory-level reset. Institute admins are tenant-scoped and so have no
 * `base` above, but they are the one account that can lock an institute out
 * entirely - their reset is institute-scoped rather than directory-scoped.
 */
export function passwordResetPath(user: DirectoryUser): string | null {
  if (user.is_owner) return null;
  if (user.role_name === "SA_INSTRUCTOR") {
    return `/super-admin/instructors/${user.id}/reset-password`;
  }
  if (user.role_name === "STUDENT" && !user.institute_id) {
    return `/super-admin/users/${user.id}/reset-password`;
  }
  if (user.role_name === "INSTITUTE_ADMIN" && user.institute_id) {
    return `/super-admin/institutes/${user.institute_id}/admins/${user.id}/reset-password`;
  }
  if (MANAGED_TENANT_ROLES.includes(user.role_name) && user.institute_id) {
    return `/super-admin/institutes/${user.institute_id}/members/${user.id}/reset-password`;
  }
  return null;
}

/** Read-only destination for tenant-scoped roles, or null when unresolvable. */
export function tenantManageLink(user: DirectoryUser, basePath = "/super-admin"): string | null {
  if (!user.institute_id) return null;
  if (user.role_name === "STUDENT") {
    return `${basePath}/institutes/${user.institute_id}/accounts/students/${user.id}`;
  }
  return `${basePath}/institutes/${user.institute_id}/accounts`;
}

export function isProtected(user: DirectoryUser): boolean {
  return user.is_owner;
}

/** Roles the Super Admin manages directly from the directory, wherever they
 *  live: institute members through their institute, direct students through
 *  the directory itself. */
const MANAGED_TENANT_ROLES: DirectoryRole[] = ["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"];

/**
 * Base path for activate/deactivate/delete on a tenant-scoped row, or null when
 * the row has no directory-level management.
 *
 * An institute member goes through their institute so seat limits and
 * membership rules are enforced by the one service that owns them. A direct
 * student belongs to no institute, so the directory manages them itself - and
 * only suspension, since there is no institute to re-home them into.
 */
export function memberActionBase(user: DirectoryUser): string | null {
  if (user.is_owner || !MANAGED_TENANT_ROLES.includes(user.role_name)) return null;
  if (user.role_name === "INSTITUTE_ADMIN" && user.institute_id) {
    return `/super-admin/institutes/${user.institute_id}/admins`;
  }
  if (user.institute_id) return `/super-admin/institutes/${user.institute_id}/members`;
  return user.role_name === "STUDENT" ? "/super-admin/users" : null;
}

/** Whether a tenant/direct row can be archived from the directory. */
export function canDeleteMember(user: DirectoryUser): boolean {
  return Boolean(memberActionBase(user));
}

/** Edit form for a tenant-scoped member, or null when there is none. */
export function memberEditPath(user: DirectoryUser, basePath = "/super-admin"): string | null {
  if (MANAGED_TENANT_ROLES.includes(user.role_name)) {
    return `${basePath}/users/${user.id}/edit`;
  }
  return null;
}
