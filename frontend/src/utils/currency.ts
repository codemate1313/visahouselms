export function currencySymbol(currency?: string | null): string {
  const code = (currency || "INR").trim().toUpperCase();
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return code;
}

export function formatCurrencyAmount(
  amount: string | number | null | undefined,
  currency?: string | null,
  options: Intl.NumberFormatOptions = {},
): string {
  const numeric = Number(amount ?? 0);
  const code = (currency || "INR").trim().toUpperCase();
  const locale = code === "INR" ? "en-IN" : "en-US";
  const value = Number.isFinite(numeric)
    ? numeric.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
    : String(amount ?? 0);
  const symbol = currencySymbol(currency);
  return `${symbol}${value}`;
}

