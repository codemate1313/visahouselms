import type { StudentPlanCatalogItem } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";

interface PlanGridProps {
  plans: StudentPlanCatalogItem[];
  selectedCurrency?: "INR" | "USD";
  onGoToCourse: () => void;
  onChoosePlan: (plan: StudentPlanCatalogItem) => void;
}

export function PlanGrid({ plans, selectedCurrency = "INR", onGoToCourse, onChoosePlan }: PlanGridProps) {
  return (
    <div className="uui-pricing-grid">
      {plans.map((plan, index) => {
        const isFeatured = index === 0 || plans.length === 1;
        const isUSD = selectedCurrency === "USD" && plan.is_international_enabled && plan.usd_price;
        const displayPrice = isUSD ? plan.usd_price : plan.price;
        const displayCurrency = isUSD ? "USD" : (plan.currency || "INR");

        return (
          <div
            className={`uui-pricing-card${isFeatured ? " is-featured" : ""}${plan.entitled ? " is-purchased" : ""}`}
            key={plan.id}
          >
            {/* Top Card Header */}
            <div className="uui-card-header">
              <div className="uui-card-title-row">
                <h3 className="uui-plan-name">{plan.name}</h3>
                {plan.entitled ? (
                  <span className="uui-purchased-badge">
                    <span className="uui-tick-bubble">
                      <Icon name="check" />
                    </span>
                    PURCHASED
                  </span>
                ) : isFeatured ? (
                  <span className="uui-popular-badge">Popular</span>
                ) : null}
              </div>

              {/* Price Display */}
              <div className="uui-price-row">
                <span className="uui-price-value">
                  {formatCurrencyAmount(displayPrice, displayCurrency)}
                </span>
                <span className="uui-price-period">/ {plan.duration_days} days</span>
              </div>

              {/* Description */}
              <p className="uui-plan-desc">{plan.description || strings.defaultDescription}</p>

              {isUSD && (
                <span className="uui-stripe-tag">
                  Global Stripe Payment
                </span>
              )}

              {/* Action Button & Status */}
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
                    <div className="uui-active-badge">
                      <span className="uui-tick-bubble-translucent">
                        <Icon name="check" />
                      </span>
                      Active Subscription
                    </div>
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
              <div className="uui-features-header">FEATURES</div>
              <p className="uui-features-subtitle">Plan inclusions and benefits:</p>

              {plan.features && plan.features.length > 0 ? (
                <ul className="uui-features-list">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="uui-feature-item">
                      <span className="uui-feature-check">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      </span>
                      <span className="uui-feature-text">{feat}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="uui-no-features">No feature bullets configured for this plan.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
