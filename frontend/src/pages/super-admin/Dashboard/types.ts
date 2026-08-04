export type MetricKey =
  | "institutes"
  | "students"
  | "online_students"
  | "active_tests"
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
  /** Which breakdown group this record belongs to; null when the metric has no
   *  breakdown. Selecting a group in the panel narrows the list to its rows. */
  group_key: string | null;
}

/** One slice of a metric's headline figure — a payment method, for revenue. */
export interface MetricBreakdownGroup {
  key: string;
  payment_method_id: number | null;
  label: string;
  total: string;
  count: number;
  currency: string;
  /** Percent of the metric total, server-computed so the segments always sum to 100. */
  share: number;
}

export interface MetricBreakdown {
  label: string;
  total: string;
  currency: string;
  groups: MetricBreakdownGroup[];
}

export interface MetricDetail {
  metric: MetricKey;
  title: string;
  description: string;
  empty_message: string;
  items: MetricDetailItem[];
  breakdown: MetricBreakdown | null;
}

export interface Summary {
  permissions: {
    can_view_monetary_analytics: boolean;
  };
  counts: {
    institutes_total: number;
    institutes_active: number;
    students_total: number;
    students_online: number;
    students_giving_tests: number;
    subscriptions_active: number;
    demo_accounts_active: number;
    coupons_active: number;
    plans_live: number;
    /** Public institute applications waiting on a Super Admin decision. */
    institute_signups_pending: number;
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
  } | null;
  revenue_by_institute: { institute_id: number; institute_name: string; total: string; count: number }[];
  revenue_by_month: { month: string; total: string; count: number }[];
  payment_status_breakdown: { status: string; count: number }[];
  student_type_breakdown: { type: "direct" | "institute"; label: string; count: number }[];
  institute_status_breakdown: { state: string; count: number }[];
}
