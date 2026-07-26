export interface LandingPlanModule {
  id: number;
  title: string;
  module_type: string;
}

/** Shape returned by the public `GET /plans` endpoint. */
export interface LandingPlan {
  id: number;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  audience: "both" | "direct_students" | "institutes";
  billing_period: "monthly" | "annual" | "custom";
  period_label: string;
  modules: LandingPlanModule[];
  features: string[];
  subscription_count: number;
  is_popular: boolean;
}
