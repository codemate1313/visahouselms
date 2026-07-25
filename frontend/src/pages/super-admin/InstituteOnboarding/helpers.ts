export const PERMISSIONS = [
  { key: "view_students", label: "View students", description: "See the institute student directory." },
  { key: "manage_students", label: "Issue and manage students", description: "Create, import, edit, activate, and delete student accounts." },
  { key: "view_student_activity", label: "View student activity", description: "Review attempts, grading history, and known devices." },
  { key: "manage_student_sessions", label: "Manage student sessions", description: "Revoke active student login sessions." },
  { key: "manage_staff", label: "Manage instructors", description: "Create and manage institute instructors." },
  { key: "view_billing", label: "View agreement", description: "See access dates, allocation, and payment history." },
] as const;

export const INITIAL_PERMISSIONS = Object.fromEntries(PERMISSIONS.map(({ key }) => [key, true])) as Record<string, boolean>;

export const INITIAL = {
  name: "", contact_email: "", admin_email: "", admin_first_name: "", admin_last_name: "",
  agreement_reference: "", agreement_notes: "", agreed_amount: "", amount_received: "", currency: "INR",
  payment_method_id: "", payment_reference: "", student_limit: "50", staff_limit: "0",
  access_duration_days: "365", primary_color: "#e53935", secondary_color: "#17191d",
};
