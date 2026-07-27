export interface CreatedInstitute {
  id: number;
  admin_email: string;
  admin_temp_password: string;
}

/** An institute-catalogue plan the agreement can be sold on. */
export interface PlanOption {
  id: number;
  name: string;
  price: string;
  currency: string;
  duration_days: number;
  student_limit: number;
  staff_limit: number;
  test_limit: number;
  grace_days: number;
  is_active: boolean;
  module_count: number;
}

/** How the agreement gets its plan: pick one from the catalogue, or author a
 *  new one here that is saved to the catalogue alongside the institute. */
export type PlanMode = "existing" | "new";

/** Fields of a plan authored from inside the institute form. */
export const EMPTY_NEW_PLAN = {
  name: "",
  description: "",
  price: "",
  currency: "INR",
  duration_days: "365",
  student_limit: "50",
  staff_limit: "0",
  test_limit: "0",
  grace_days: "0",
};

/** A plan's headline numbers, for the "what this agreement grants" summary. */
export function planSummaryLine(plan: {
  student_limit: number;
  staff_limit: number;
  duration_days: number;
  test_limit?: number;
  module_count?: number;
}): string {
  const parts = [
    `${plan.student_limit} students`,
    `${plan.staff_limit} instructors`,
    `${plan.duration_days} days`,
    plan.test_limit ? `${plan.test_limit} tests` : "unlimited tests",
  ];
  if (plan.module_count !== undefined) parts.push(`${plan.module_count} courses`);
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
