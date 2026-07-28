export interface Payment {
  id: number;
  invoice_number: string | null;
  plan_name: string | null;
  final_amount: string;
  currency: string;
  status: string;
  created_at: string;
}

export interface SubscriptionStatus {
  state: string;
  usage: { students: number; staff: number; tests: number };
  limits: { students: number; staff: number; tests: number | null } | null;
  subscription: { plan_name: string; expires_at: string; days_remaining: number | null } | null;
}

export { SUBSCRIPTION_STATE_BADGES as STATE_CLASS } from "@/constants";
