export interface PlanRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  student_limit: number;
  test_limit: number;
  staff_limit: number;
  grace_days: number;
  is_active: boolean;
  is_published: boolean;
  audience: "both" | "direct_students" | "institutes";
  module_count: number;
  subscription_count: number;
}
