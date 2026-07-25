export interface CreatedInstitute {
  id: number;
  admin_email: string;
  admin_temp_password: string;
}

export type PermissionKey =
  | "view_students"
  | "manage_students"
  | "view_student_activity"
  | "manage_student_sessions"
  | "manage_staff"
  | "view_billing";

export type InstitutePermissions = Record<PermissionKey, boolean>;

export const DEFAULT_PERMISSIONS: InstitutePermissions = {
  view_students: false,
  manage_students: false,
  view_student_activity: false,
  manage_student_sessions: false,
  manage_staff: false,
  view_billing: false,
};
