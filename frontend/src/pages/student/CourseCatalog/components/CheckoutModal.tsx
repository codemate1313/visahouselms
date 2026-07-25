import type { FormEvent } from "react";
import type { StudentPlanCatalogItem } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";

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
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>{t.heading(plan.name)}</h2>
        <p>{formatCurrencyAmount(plan.price, plan.currency)}</p>
        <form onSubmit={onSubmit} className="form-card">
          <label htmlFor="coupon">{t.couponLabel}</label>
          <input id="coupon" value={couponCode} onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())} placeholder={t.couponPlaceholder} />
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" disabled={buying}>
              {buying ? t.processing : t.confirmPurchase}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
