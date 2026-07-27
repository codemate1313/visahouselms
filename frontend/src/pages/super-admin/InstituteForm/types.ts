export interface CreatedInstitute {
  id: number;
  admin_email: string;
  admin_temp_password: string;
}

/** The provisions an institute currently holds, as the API returns them. */
export interface InstituteAllocation {
  student_limit: number;
  staff_limit: number;
  duration_days: number;
  grace_days: number;
  module_count: number;
}

/** Provisions allocated on the institute form. There is no plan to name or
 *  price - the server derives one - and no test ceiling, since an institute's
 *  students take as many tests as they like. */
export const EMPTY_ALLOCATION = {
  student_limit: "50",
  staff_limit: "0",
  access_duration_days: "365",
  grace_days: "0",
};

/** The headline numbers, for the "this institute gets" summary. */
export function allocationSummaryLine(allocation: {
  student_limit: number;
  staff_limit: number;
  duration_days: number;
  module_count?: number;
}): string {
  const parts = [
    `${allocation.student_limit} students`,
    `${allocation.staff_limit} instructors`,
    `${allocation.duration_days} days`,
    "unlimited tests",
  ];
  if (allocation.module_count !== undefined) parts.push(`${allocation.module_count} courses`);
  return parts.join(" · ");
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
