export function formatCurrency(amountStr: string | number) {
  const num = Number(amountStr) || 0;
  return `INR ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
