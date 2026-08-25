import { formatCurrencyAmount } from "@/utils/currency";

export function formatCurrency(amountStr: string | number) {
  const num = Number(amountStr) || 0;
  // NOTE: hardcoded to INR because the revenue summary the backend returns
  // (app/services/revenue_service.py) sums Payment.final_amount across all
  // rows with no currency field or per-currency breakdown - every payment,
  // regardless of its actual `Payment.currency`, is folded into one number.
  // Plans can be sold in USD (see PlanForm's international pricing), so if
  // any USD payments exist this total silently mixes currencies and this
  // label will be wrong. Fixing this correctly requires a backend change to
  // segment revenue by currency (or convert to a common currency) before it
  // reaches the frontend - tracked as a follow-up, not fixed here.
  return formatCurrencyAmount(num, "INR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
