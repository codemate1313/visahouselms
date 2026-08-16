export interface Payment {
  id: number;
  invoice_number: string | null;
  plan_name: string | null;
  final_amount: string;
  currency: string;
  status: string;
  created_at: string;
}

/** One term the institute has paid for and not yet used up. */
export interface SubscriptionTerm {
  plan_name: string;
  state: string;
  starts_at: string;
  expires_at: string;
  days_remaining: number | null;
}

/** Seats are the SUM across live terms, so a second plan adds capacity - and
 *  that capacity steps back down when the first term runs out. This is that
 *  step, so an admin sees it coming. */
export interface SeatStep {
  from: string;
  until: string;
  seats: number;
}

export interface SubscriptionStatus {
  state: string;
  usage: { students: number; staff: number; tests: number };
  limits: { students: number; staff: number; tests: number | null } | null;
  subscription: { plan_name: string; expires_at: string; days_remaining: number | null } | null;
  terms?: SubscriptionTerm[];
  seat_timeline?: SeatStep[];
}

/** One plan an institute may buy its next term on, priced server-side. */
export interface RenewalOption {
  plan_id: number;
  plan_name: string;
  description: string | null;
  currency: string;
  duration_days: number;
  grace_days: number;
  student_limit: number;
  staff_limit: number;
  features: string[];
  is_current: boolean;
  held_before: boolean;
  is_available: boolean;
  new_starts_at: string;
  new_expires_at: string;
  base_amount: number;
  subtotal_amount: number;
  gst_percentage: number;
  gst_tax_type: string;
  gst_amount: number;
  final_amount: number;
  /** False for internal, QA and comped plans - the term extends without a checkout. */
  requires_payment: boolean;
  online_payment_available: boolean;
}

export interface RenewalOptions {
  state: string;
  /** True for an institute buying its first term rather than extending one. */
  is_activation: boolean;
  current_plan_id: number | null;
  current_plan_name: string | null;
  current_expires_at: string | null;
  new_starts_at: string;
  options: RenewalOption[];
}

export interface RenewalOrder {
  online_payment: boolean;
  requires_payment?: boolean;
  gateway?: string;
  order_id?: string;
  key_id?: string;
  amount?: number;
  currency?: string;
  plan_name?: string;
  payment_id?: number;
}

export { SUBSCRIPTION_STATE_BADGES as STATE_CLASS } from "@/constants";
