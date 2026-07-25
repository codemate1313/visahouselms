export interface CouponRow {
  id: number;
  code: string;
  discount_type: "percent" | "flat";
  value: string;
  scope: string;
  scope_plan_id: number | null;
  scope_course_id: number | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}
