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
  is_international_enabled?: boolean;
  usd_price?: string | null;
  duration_days: number;
  audience: "both" | "direct_students" | "institutes";
  billing_period: "monthly" | "annual" | "custom";
  period_label: string;
  modules: LandingPlanModule[];
  features: string[];
  subscription_count: number;
  is_popular: boolean;
}

export interface PricingLocation {
  country: string;
  default_currency: "INR" | "USD";
  conversion?: {
    rate: number;
    date: string | null;
    source: string;
  };
}

/**
 * Both catalogues plus the Super Admin's visibility flags. A hidden catalogue
 * arrives as an empty list, so the page never has to infer intent from
 * emptiness — the flags say whether a switch belongs on the page at all.
 */
export interface LandingPlansPayload {
  show_direct: boolean;
  show_institutes: boolean;
  direct_students: LandingPlan[];
  institutes: LandingPlan[];
}
