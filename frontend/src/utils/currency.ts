export function currencySymbol(currency?: string | null): string {
  return (currency || "INR").trim().toUpperCase() === "INR" ? "₹" : (currency || "").trim();
}

export function formatCurrencyAmount(
  amount: string | number | null | undefined,
  currency?: string | null,
  options: Intl.NumberFormatOptions = {},
): string {
  const numeric = Number(amount ?? 0);
  const value = Number.isFinite(numeric)
    ? numeric.toLocaleString("en-IN", options)
    : String(amount ?? 0);
  const symbol = currencySymbol(currency);
  return symbol === "₹" ? `${symbol}${value}` : `${symbol} ${value}`.trim();
}
