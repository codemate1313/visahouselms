export interface ModuleOption {
  id: number;
  title: string;
  module_type: string;
  duration_minutes: number;
  created_by_name: string;
}

export interface Method {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Onboarding {
  id: number;
  name: string;
  onboarding_status: "draft" | "published";
  agreed_amount: string;
  agreement_currency: string;
  student_limit: number;
  staff_limit: number;
  access_duration_days: number;
  course_count: number;
  module_ids: number[];
  admin_permissions: Record<string, boolean>;
  branding: { primary_color: string; secondary_color: string; logo_url?: string | null };
  payment: { amount_paid: string; status: string } | null;
  admin_email?: string;
  admin_temp_password?: string;
}
