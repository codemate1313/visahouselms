export type SignupStatus = "pending" | "approved" | "rejected";

export interface InstituteSignupRequest {
  id: number;
  institute_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  expected_students: number | null;
  message: string | null;
  interested_plan_id: number | null;
  interested_plan_name: string | null;
  status: SignupStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_institute_id: number | null;
  created_at: string;
  /** Returned only by the approve call, and only that once. */
  admin_temp_password?: string;
}
