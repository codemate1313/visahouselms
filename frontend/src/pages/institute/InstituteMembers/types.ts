/** Mirrors the backend's ACCESS_* constants (app/models/user.py).
 *
 *  `is_active` still answers "can they sign in"; this answers "does this
 *  account cost the institute a seat", which is a different question:
 *  suspended and expired students still hold theirs. Only `released` gives
 *  a seat back, and only an admin can cause it. */
export type AccessState = "active" | "suspended" | "expired" | "released";

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
  access_state: AccessState;
  /** Calendar dates in the institute's timezone, not instants. */
  access_starts_on: string | null;
  access_ends_on: string | null;
  holds_seat: boolean;
  window_open: boolean;
  days_remaining: number | null;
  timezone: string;
}

export interface ImportResult {
  summary: {
    total_rows: number;
    created: number;
    skipped: number;
    invalid_emails?: number;
    remaining_slots: number;
  };
  created: Array<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    temporary_password: string;
    access_starts_on: string;
    access_ends_on: string;
  }>;
  skipped: Array<{ row: number; email: string | null; reason: string; invalid_email?: boolean }>;
  invalid_emails?: Array<{ row: number; email: string | null; reason: string }>;
}

export interface MemberCapacity {
  usage: { students: number; staff: number };
  limits: { students: number | null; staff: number | null };
  can_add: { students: boolean; staff: boolean };
  seats: {
    used: number;
    total: number | null;
    free: number | null;
    active: number;
    suspended: number;
    /** Locked out but still holding a seat - the reclaimable ones. */
    expired: number;
    reclaimable: number;
    /** Released: no seat, record intact, reactivatable. */
    past_students: number;
  };
  /** Nothing may be granted past this date. */
  subscription_ends_on: string | null;
}
