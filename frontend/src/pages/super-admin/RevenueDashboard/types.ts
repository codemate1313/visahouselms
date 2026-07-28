export interface InstituteRow {
  id: number;
  name: string;
}

export interface InstituteBreakdown {
  institute_id: number;
  institute_name: string;
  total: string;
  count: number;
}

export interface MethodRow {
  id: number;
  name: string;
  is_active: boolean;
}

export interface MethodBreakdown {
  payment_method_id: number | null;
  payment_method_name: string;
  total: string;
  count: number;
}

export interface MonthBreakdown {
  month: string;
  total: string;
  count: number;
}

export interface DueRow {
  id: number;
  institute_name: string | null;
  invoice_number: string | null;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  created_at: string;
}

export interface Summary {
  total_revenue: string;
  b2b_revenue: string;
  b2c_revenue: string;
  total_due: string;
  transaction_count: number;
  by_institute: InstituteBreakdown[];
  by_method: MethodBreakdown[];
  by_month: MonthBreakdown[];
  dues: DueRow[];
}
