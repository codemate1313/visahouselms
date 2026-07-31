/** Which catalogues the public pricing page lists, keyed by audience. */
export interface PlanVisibility {
  direct_students: boolean;
  institutes: boolean;
}

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
  is_international_enabled?: boolean;
  usd_price?: string | null;
  module_count: number;

  /** Authored pricing-card bullets; empty means the public page derives them. */
  features: string[];
  subscription_count: number;
}
