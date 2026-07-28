import type { FormEvent } from "react";
import type { StudentPlanCatalogItem } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";
import { Button } from "@/components/ui/Button/Button";

interface CheckoutModalProps {
  plan: StudentPlanCatalogItem;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  buying: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

export function CheckoutModal({ plan, couponCode, onCouponCodeChange, buying, onSubmit, onClose }: CheckoutModalProps) {
  const t = strings.checkout;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card catalog-checkout-modal" onClick={(event) => event.stopPropagation()}>
        <div className="catalog-checkout-header">
          <div>
            <h2>{t.heading(plan.name)}</h2>
            <p className="catalog-checkout-subtitle">Review your plan details and complete purchase</p>
          </div>
          <button type="button" className="catalog-checkout-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="catalog-checkout-summary-card">
          <div className="catalog-checkout-plan-info">
            <span className="catalog-checkout-plan-name">{plan.name}</span>
            <span className="catalog-checkout-plan-meta">{plan.duration_days} Days Validity · {plan.module_count} Test Modules</span>
          </div>
          <div className="catalog-checkout-plan-price">
            {formatCurrencyAmount(plan.price, plan.currency)}
          </div>
        </div>

        <form onSubmit={onSubmit} className="catalog-checkout-form">
          <div className="catalog-coupon-group">
            <label htmlFor="coupon">{t.couponLabel}</label>
            <div className="catalog-coupon-input-wrapper">
              <input
                id="coupon"
                value={couponCode}
                onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
                placeholder={t.couponPlaceholder}
                className="catalog-coupon-input"
              />
            </div>
          </div>

          <div className="form-actions catalog-checkout-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" variant="primary" loading={buying} className="catalog-plan-btn">
              {buying ? t.processing : t.confirmPurchase}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
