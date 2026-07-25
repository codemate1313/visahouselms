export interface InstituteRow {
  id: number;
  name: string;
}

export interface MethodRow {
  id: number;
  name: string;
  is_active: boolean;
}

export interface PaymentRow {
  id: number;
  source: string;
  institute_name: string | null;
  plan_name: string | null;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  currency: string;
  status: string;
  invoice_number: string | null;
  created_at: string;
}
