import type { StudentPlanCatalogItem } from "@/api/types";

export interface CatalogDisplayPrice {
  amount: number;
  currency: string;
  isConverted: boolean;
  usesInternationalPrice: boolean;
}

export function getCatalogDisplayPrice(
  plan: StudentPlanCatalogItem,
  selectedCurrency: "INR" | "USD",
  inrUsdRate?: number | null,
): CatalogDisplayPrice {
  const baseAmount = Number(plan.price);
  const baseCurrency = plan.currency || "INR";
  if (selectedCurrency !== "USD") {
    return { amount: baseAmount, currency: baseCurrency, isConverted: false, usesInternationalPrice: false };
  }

  const usdAmount = Number(plan.usd_price);
  if (plan.is_international_enabled && plan.usd_price != null && plan.usd_price !== "" && Number.isFinite(usdAmount)) {
    return { amount: usdAmount, currency: "USD", isConverted: false, usesInternationalPrice: true };
  }

  const rate = Number(inrUsdRate);
  if (baseCurrency.toUpperCase() === "INR" && Number.isFinite(baseAmount) && Number.isFinite(rate) && rate > 0) {
    return { amount: baseAmount * rate, currency: "USD", isConverted: true, usesInternationalPrice: false };
  }

  return { amount: baseAmount, currency: baseCurrency, isConverted: false, usesInternationalPrice: false };
}
