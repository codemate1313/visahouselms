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

  /* The server sends the figure the checkout will actually charge, explicit or
     converted. Converting again here produced a price a few cents away from
     the one the student was billed - and, for a plan with no USD price set at
     all, a dollar figure on the card while the order was placed in rupees. */
  const effective = Number(plan.usd_price_effective ?? plan.usd_price);
  if (Number.isFinite(effective) && effective > 0) {
    return {
      amount: effective,
      currency: "USD",
      isConverted: Boolean(plan.usd_price_is_estimated),
      usesInternationalPrice: !plan.usd_price_is_estimated,
    };
  }

  const rate = Number(inrUsdRate);
  if (baseCurrency.toUpperCase() === "INR" && Number.isFinite(baseAmount) && Number.isFinite(rate) && rate > 0) {
    return { amount: baseAmount * rate, currency: "USD", isConverted: true, usesInternationalPrice: false };
  }

  return { amount: baseAmount, currency: baseCurrency, isConverted: false, usesInternationalPrice: false };
}
