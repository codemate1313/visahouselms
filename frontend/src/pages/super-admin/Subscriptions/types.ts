export interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface SubscriptionInfo {
  id: number;
  plan_id: number;
  plan_name: string | null;
  starts_at: string;
  expires_at: string;
  grace_days: number;
  cancelled_at: string | null;
  state: string;
  days_remaining: number | null;
  created_at: string;
}

export interface StatusResponse {
  subscription: SubscriptionInfo | null;
  state: string;
  usage: Record<string, number>;
  limits: Record<string, number> | null;
}
