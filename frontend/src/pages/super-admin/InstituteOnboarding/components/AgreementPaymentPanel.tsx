import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { SearchableSelect } from "@/components/ui";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";
import type { Method } from "../types";

interface AgreementPaymentPanelProps {
  form: typeof INITIAL;
  set: (field: keyof typeof INITIAL) => (event: { target: { value: string } }) => void;
  methods: Method[];
  onPaymentMethodChange: (value: string) => void;
}

export function AgreementPaymentPanel({ form, set, methods, onPaymentMethodChange }: AgreementPaymentPanelProps) {
  const t = strings.step1.agreementPayment;
  return (
    <CollapsiblePanel className="form-card onboarding-section-card" title={t.title} description={t.description}>
      <div className="form-grid">
        <div>
          <label>{t.agreedAmount}</label>
          <input type="number" min="1" value={form.agreed_amount} onChange={set("agreed_amount")} required placeholder={t.amountPlaceholder} />
        </div>
        <div>
          <label>{t.amountReceived}</label>
          <input type="number" min="1" value={form.amount_received} onChange={set("amount_received")} required placeholder={t.amountPlaceholder} />
        </div>
        <div>
          <label>{t.currency}</label>
          <input value={form.currency} onChange={set("currency")} required />
        </div>
        <div>
          <label>{t.paymentMethod}</label>
          <SearchableSelect
            options={[{ value: "", label: t.manualUnspecified }, ...methods.map((method) => ({ value: method.id, label: method.name }))]}
            value={form.payment_method_id}
            onChange={(value) => onPaymentMethodChange(String(value))}
            searchPlaceholder={t.searchPaymentMethods}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label>{t.receiptReference}</label>
          <input value={form.payment_reference} onChange={set("payment_reference")} placeholder={t.receiptPlaceholder} />
        </div>
        <div>
          <label>{t.agreementReference}</label>
          <input value={form.agreement_reference} onChange={set("agreement_reference")} placeholder={t.agreementReferencePlaceholder} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>{t.agreementNotes}</label>
        <textarea rows={2} value={form.agreement_notes} onChange={set("agreement_notes")} placeholder={t.agreementNotesPlaceholder} />
      </div>

      <h3 className="section-subheading" style={{ marginTop: 20 }}>
        {t.allocationHeading}
      </h3>
      <div className="form-grid">
        <div>
          <label>{t.studentLimit}</label>
          <input type="number" min="0" value={form.student_limit} onChange={set("student_limit")} required />
        </div>
        <div>
          <label>{t.instructorLimit}</label>
          <input type="number" min="0" value={form.staff_limit} onChange={set("staff_limit")} required />
        </div>
        <div>
          <label>{t.durationDays}</label>
          <input type="number" min="1" value={form.access_duration_days} onChange={set("access_duration_days")} required />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
