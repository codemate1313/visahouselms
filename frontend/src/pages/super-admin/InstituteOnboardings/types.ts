export interface OnboardingRow {
  id: number;
  name: string;
  contact_email: string | null;
  onboarding_status: "draft" | "published";
  agreed_amount: string;
  agreement_currency: string;
  payment: { amount_paid: string; status: string } | null;
  student_limit: number;
  staff_limit: number;
  course_count: number;
  member_count: number;
  created_at: string;
}
