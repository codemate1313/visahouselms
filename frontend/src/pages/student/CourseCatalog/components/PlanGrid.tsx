import type { StudentPlanCatalogItem } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";

interface PlanGridProps {
  plans: StudentPlanCatalogItem[];
  onGoToCourse: () => void;
  onChoosePlan: (plan: StudentPlanCatalogItem) => void;
}

export function PlanGrid({ plans, onGoToCourse, onChoosePlan }: PlanGridProps) {
  return (
    <div className="catalog-plans-grid">
      {plans.map((plan, index) => {
        const isFeatured = index === 0 || plans.length === 1;
        return (
          <div className={`catalog-plan-card${isFeatured ? " is-featured" : ""}`} key={plan.id}>
            {isFeatured && (
              <div className="catalog-plan-badge">
                <Icon name="plan" /> MOST POPULAR
              </div>
            )}

            <div className="catalog-plan-header">
              <div className="catalog-plan-duration-chip">
                <Icon name="due" /> {strings.durationSuffix(plan.duration_days)} validity
              </div>
              <h2 className="catalog-plan-title">{plan.name}</h2>
              <p className="catalog-plan-desc">{plan.description || strings.defaultDescription}</p>
            </div>

            <div className="catalog-plan-price-box">
              <div className="catalog-plan-price">
                <span className="catalog-plan-currency-val">{formatCurrencyAmount(plan.price, plan.currency)}</span>
                <span className="catalog-plan-period">/ {plan.duration_days} days</span>
              </div>
              <div className="catalog-plan-tests-count">
                <Icon name="module" /> {strings.testsCount(plan.module_count)} included
              </div>
            </div>

            <div className="catalog-plan-features">
              <span className="catalog-features-title">INCLUDED TEST MODULES ({plan.modules?.length ?? 0}):</span>
              {plan.modules && plan.modules.length > 0 ? (
                <ul className="catalog-modules-real-list">
                  {plan.modules.map((m) => (
                    <li key={m.id || m.title} className="catalog-real-module-item">
                      <span className="catalog-check-icon">✓</span>
                      <div className="catalog-module-info">
                        <span className="catalog-module-name">{m.title}</span>
                        <div className="catalog-module-meta-tags">
                          <span className="catalog-module-type-pill" data-type={m.module_type}>
                            {m.module_type.replaceAll("_", " ")}
                          </span>
                          <span className="catalog-module-duration">{m.duration_minutes} mins</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="catalog-no-modules">No test modules linked to this plan.</p>
              )}
            </div>

            <div className="catalog-plan-footer">
              {plan.entitled ? (
                <div className="catalog-plan-entitled-box">
                  <div className="catalog-active-badge">✓ Active Subscription</div>
                  <Button
                    variant="primary"
                    fullWidth
                    rightIcon={<Icon name="arrowRight" />}
                    onClick={onGoToCourse}
                    className="catalog-plan-btn"
                  >
                    {strings.goToCourse}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  rightIcon={<Icon name="arrowRight" />}
                  onClick={() => onChoosePlan(plan)}
                  className="catalog-plan-btn"
                >
                  {strings.choosePlan}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
