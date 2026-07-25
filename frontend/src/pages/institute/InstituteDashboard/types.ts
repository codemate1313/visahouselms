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
  permissions: Record<string, boolean>;
  recent_members: MemberSummary[];
}

export const STATE_CLASS: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  none: "badge-gray",
};
