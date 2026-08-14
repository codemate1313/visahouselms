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
  student_limit: "",
  staff_limit: "",
  access_duration_days: "",
  grace_days: "",
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

