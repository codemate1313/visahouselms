export type MetricKey =
  | "institutes"
  | "subscriptions"
  | "revenue"
  | "dues"
  | "transactions"
  | "demos"
  | "instructors"
  | "modules";

export type DetailValueType = "text" | "number" | "money" | "date";

export interface MetricDetailValue {
  label: string;
  value: string | number | null;
  value_type: DetailValueType;
  currency: string | null;
}

export interface MetricDetailItem {
  id: string;
  title: string;
  subtitle: string | null;
  status_label: string | null;
  status_tone: "green" | "blue" | "amber" | "red" | "purple" | "slate";
  value: string | number | null;
  value_label: string | null;
  value_type: DetailValueType;
  currency: string | null;
  metadata: MetricDetailValue[];
}

export interface MetricDetail {
  metric: MetricKey;
  title: string;
  description: string;
  empty_message: string;
  items: MetricDetailItem[];
}

export interface Summary {
  counts: {
    institutes_total: number;
    institutes_active: number;
    subscriptions_active: number;
    demo_accounts_active: number;
    coupons_active: number;
    plans_live: number;
    super_admin_accounts: number;
    sa_instructor_accounts: number;
    modules_total: number;
    modules_published: number;
  };
  revenue: {
    total_revenue: string;
    b2b_revenue: string;
    b2c_revenue: string;
    total_due: string;
    transaction_count: number;
  };
  revenue_by_institute: { institute_id: number; institute_name: string; total: string; count: number }[];
  revenue_by_month: { month: string; total: string; count: number }[];
  payment_status_breakdown: { status: string; count: number }[];
  institute_status_breakdown: { state: string; count: number }[];
}
