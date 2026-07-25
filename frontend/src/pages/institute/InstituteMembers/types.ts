export interface InstituteMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "STUDENT" | "INST_INSTRUCTOR";
  is_active: boolean;
  force_password_reset: boolean;
  phone_number: string | null;
  address: string | null;
  deleted_at: string | null;
  attempt_count: number;
  device_count: number;
  active_session_count: number;
  created_at: string;
}

export interface ImportResult {
  summary: { total_rows: number; created: number; skipped: number; remaining_slots: number };
  created: Array<{ id: number; email: string; first_name: string; last_name: string; temporary_password: string }>;
  skipped: Array<{ row: number; email: string | null; reason: string }>;
}

export interface MemberCapacity {
  usage: { students: number; staff: number };
  limits: { students: number | null; staff: number | null };
  can_add: { students: boolean; staff: boolean };
}
