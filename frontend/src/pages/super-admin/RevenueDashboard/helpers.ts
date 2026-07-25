import { formatCurrencyAmount } from "@/utils/currency";

export function formatCurrency(amountStr: string | number) {
  const num = Number(amountStr) || 0;
  return formatCurrencyAmount(num, "INR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
