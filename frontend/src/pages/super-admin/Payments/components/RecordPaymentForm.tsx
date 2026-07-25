import type { FormEvent } from "react";
import { SearchableSelect } from "@/components/ui";
import type { PlanRow } from "@/pages/super-admin/Plans";
import { formatCurrencyAmount } from "@/utils/currency";
import { paymentsStrings as strings } from "../Payments.strings";
import type { InstituteRow, MethodRow } from "../types";

interface RecordPaymentFormProps {
  institutes: InstituteRow[];
  plans: PlanRow[];
  methods: MethodRow[];
  instituteId: string;
  onInstituteIdChange: (value: string) => void;
  planId: string;
  onPlanIdChange: (value: string) => void;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  amountReceived: string;
  onAmountReceivedChange: (value: string) => void;
  methodId: string;
  onMethodIdChange: (value: string) => void;
  reference: string;
  onReferenceChange: (value: string) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function RecordPaymentForm({
  institutes,
  plans,
  methods,
  instituteId,
  onInstituteIdChange,
  planId,
  onPlanIdChange,
  couponCode,
  onCouponCodeChange,
  amountReceived,
  onAmountReceivedChange,
  methodId,
  onMethodIdChange,
  reference,
  onReferenceChange,
  error,
  saving,
  onSubmit,
}: RecordPaymentFormProps) {
  const t = strings.recordForm;
  const selectedPlan = plans.find((p) => String(p.id) === planId);

  return (
    <form className="form-card wide onboarding-section-card payment-record-form" onSubmit={onSubmit} style={{ marginBottom: 24 }}>
      <h2>{t.heading}</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        {t.description}
      </p>

      <div className="form-grid">
        <div>
          <label htmlFor="institute">{t.instituteLabel}</label>
          <SearchableSelect
            id="institute"
            options={[{ value: "", label: t.selectInstitute }, ...institutes.map((i) => ({ value: i.id, label: i.name }))]}
            value={instituteId}
            onChange={(value) => onInstituteIdChange(String(value))}
            searchPlaceholder={t.searchInstitutes}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="plan">{t.planLabel}</label>
          <SearchableSelect
            id="plan"
            options={[{ value: "", label: t.selectPlan }, ...plans.filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.name} - ${formatCurrencyAmount(p.price, p.currency)}` }))]}
            value={planId}
            onChange={(value) => onPlanIdChange(String(value))}
            searchPlaceholder={t.searchPlans}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="coupon">{t.couponLabel}</label>
          <input id="coupon" value={couponCode} onChange={(e) => onCouponCodeChange(e.target.value)} placeholder={t.couponPlaceholder} />
        </div>
        <div>
          <label htmlFor="amount_received">{t.amountReceivedLabel}</label>
          <input
            id="amount_received"
            type="number"
            min="0"
            step="0.01"
            value={amountReceived}
            onChange={(e) => onAmountReceivedChange(e.target.value)}
            placeholder={selectedPlan ? `${t.fullPricePrefix} ${selectedPlan.price}` : t.fullPrice}
          />
        </div>
        <div>
          <label htmlFor="method">{t.methodLabel}</label>
          <SearchableSelect
            id="method"
            options={[{ value: "", label: t.selectMode }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
            value={methodId}
            onChange={(value) => onMethodIdChange(String(value))}
            searchPlaceholder={t.searchModes}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="reference">{t.referenceLabel}</label>
          <input id="reference" value={reference} onChange={(e) => onReferenceChange(e.target.value)} placeholder={t.referencePlaceholder} />
        </div>
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

      <div className="form-actions" style={{ marginTop: 20 }}>
        <button type="submit" className="primary-submit-btn" disabled={saving}>
          {saving ? t.recording : t.submit}
        </button>
      </div>
    </form>
  );
}
