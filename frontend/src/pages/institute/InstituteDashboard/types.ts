export interface MemberSummary {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface DashboardSummary {
  institute: { name: string; contact_email: string | null };
  counts: { students: number; instructors: number; active_members: number };
  subscription: null | {
    state: string;
    usage: { students: number; staff: number; tests: number };
    limits: { students: number; staff: number; tests: number | null } | null;
    subscription: { plan_name: string; expires_at: string; days_remaining: number | null } | null;
  };
  access: AccessWindow;
  permissions: Record<string, boolean>;
  recent_members: MemberSummary[];
}

/** Countdown to the moment the institute (and every account under it) loses
 *  access — expiry plus the plan's grace days. */
export interface AccessWindow {
  state: string;
  plan_name: string | null;
  expires_at: string | null;
  grace_days: number;
  access_ends_at: string | null;
  seconds_remaining: number | null;
  seconds_to_expiry: number | null;
  institute_suspended: boolean;
}

export const STATE_CLASS: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};
