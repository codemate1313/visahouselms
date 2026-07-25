import type { InstituteMember } from "../InstituteMembers";

export type { InstituteMember };

export interface DeviceRecord {
  id: number;
  name: string | null;
  user_agent: string | null;
  last_ip_address: string | null;
  login_count: number;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface AttemptRecord {
  id: number;
  module_title: string;
  module_type: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  raw_score: string | null;
  max_score: string | null;
  graders: Array<{ id: number | null; name: string; email: string | null; part: string; status: string; graded_at: string | null }>;
}

export interface StudentOverviewData {
  student: InstituteMember;
  security: { device_count: number; active_session_count: number; last_login_at: string | null; devices: DeviceRecord[] };
  attempts: AttemptRecord[];
}
