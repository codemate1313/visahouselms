export interface DemoRow {
  id: number;
  institute_id: number;
  institute_name: string;
  duration_days: number;
  course_limit: number;
  test_limit: number;
  expires_at: string;
  converted_at: string | null;
  state: "active" | "expired" | "converted";
  days_remaining: number | null;
  created_at: string;
}

export interface CreatedDemo {
  admin_email: string;
  admin_temp_password: string;
}
