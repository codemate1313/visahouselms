import type { StudentPlanCatalogItem } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";
import { getCatalogDisplayPrice } from "../pricing";

interface PlanGridProps {
  plans: StudentPlanCatalogItem[];
  selectedCurrency?: "INR" | "USD";
  inrUsdRate?: number | null;
  onGoToCourse: () => void;
  onChoosePlan: (plan: StudentPlanCatalogItem) => void;
}

export function PlanGrid({
  plans,
  selectedCurrency = "INR",
  inrUsdRate,
  onGoToCourse,
  onChoosePlan,
}: PlanGridProps) {
  return (
    <div className="uui-pricing-grid">
      {plans.map((plan) => {
        const isFeatured = Boolean(plan.is_popular);
        const display = getCatalogDisplayPrice(plan, selectedCurrency, inrUsdRate);

        return (
          <div
            className={`uui-pricing-card${isFeatured ? " is-featured" : ""}${
              plan.entitled ? " is-purchased" : ""
            }`}
            key={plan.id}
          >
            {/* Top Card Header */}
            <div className="uui-card-header">
              <div className="uui-card-title-row">
                <h3 className="uui-plan-name">{plan.name}</h3>
                {plan.entitled ? (
                  <span
                    className="uui-purchased-badge"
                    title={
                      plan.entitled_until
                        ? strings.purchasedUntilTooltip(formatPlanDay(plan.entitled_until))
                        : undefined
                    }
                  >
                    <span className="uui-purchased-dot" />
                    PURCHASED
                  </span>
                ) : isFeatured ? (
                  <span className="uui-popular-badge">Popular</span>
                ) : null}
              </div>

              {/* Price Display */}
              <div className="uui-price-row">
                <span className="uui-price-value">
                  {display.isConverted ? "≈" : ""}
                  {formatCurrencyAmount(display.amount, display.currency)}
                </span>
                <span className="uui-price-period">/ {plan.duration_days} days</span>
              </div>

              {/* Description */}
              <p className="uui-plan-desc">{plan.description || strings.defaultDescription}</p>

              {/* Says when it runs out, so "purchased" is actionable rather
                  than just a state. Without it a student has no idea when they
                  can buy it again. */}
              {plan.entitled && plan.entitled_until && (
                <p className="uui-purchased-until">
                  {strings.purchasedUntil(formatPlanDay(plan.entitled_until))}
                </p>
              )}

              {(display.usesInternationalPrice || display.isConverted) && (
                <span className="uui-stripe-tag">
                  {display.usesInternationalPrice
                    ? "Global Stripe Payment"
                    : "Approx. USD converted from INR · billed in INR"}
                </span>
              )}

              {/* Action Button */}
              <div className="uui-action-group">
                {plan.entitled ? (
                  <>
                    <Button
                      variant="primary"
                      fullWidth
                      rightIcon={<Icon name="arrowRight" />}
                      onClick={onGoToCourse}
                      className="uui-btn-primary"
                    >
                      {strings.goToCourse}
                    </Button>
                    {/* Buying again is allowed and always adds - the days stack
                        onto every module in the plan and each purchase hands
                        over another attempt. The badge above is information,
                        not a gate. */}
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => onChoosePlan(plan)}
                      className="uui-btn-buy-again"
                    >
                      {strings.buyAgain}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    rightIcon={<Icon name="arrowRight" />}
                    onClick={() => onChoosePlan(plan)}
                    className="uui-btn-primary"
                  >
                    {strings.choosePlan}
                  </Button>
                )}
              </div>
            </div>

            {/* Lower Features Section */}
            <div className="uui-card-features">
              <div className="uui-features-header">What's included:</div>

              {plan.features && plan.features.length > 0 ? (
                <ul className="uui-features-list">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="uui-feature-item">
                      <span className="uui-feature-check">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      <span className="uui-feature-text">{feat}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="uui-no-features">All course tests and study materials included.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatPlanDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
