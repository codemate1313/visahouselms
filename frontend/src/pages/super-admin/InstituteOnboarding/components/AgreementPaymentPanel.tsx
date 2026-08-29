import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";
import type { Method } from "../types";

// Mirrors SUPPORTED_CURRENCIES in PlanForm/index.tsx - keep in sync with that
// list (and with formatCurrencyAmount in src/utils/currency.ts, which is the
// ultimate source of truth for which currencies the UI can render a symbol
// for). Not imported directly: PlanForm's file only exports a component, so
// importing a constant from it would break React Fast Refresh there.
const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

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
          <label>{t.agreedAmount}<RequiredMark /></label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.agreed_amount}
            onChange={(e) => {
              const val = e.target.value.replace(/,/g, ".");
              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                set("agreed_amount")({ target: { value: val } });
              }
            }}
            required
            placeholder={t.amountPlaceholder}
          />
        </div>
        <div>
          <label>{t.amountReceived}<RequiredMark /></label>
          {/* 0 is a legitimate value here - the agreement can be signed with
              nothing paid yet, recorded as a due balance on the Payments screen. */}
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.amount_received}
            onChange={(e) => {
              const val = e.target.value.replace(/,/g, ".");
              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                set("amount_received")({ target: { value: val } });
              }
            }}
            required
            placeholder={t.amountPlaceholder}
          />
        </div>
        <div>
          <label>{t.currency}<RequiredMark /></label>
          <SearchableSelect
            value={form.currency}
            onChange={(value) => set("currency")({ target: { value: String(value) } })}
            options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label>{t.paymentMethod}<RequiredMark /></label>
          <SearchableSelect
            options={methods.map((method) => ({ value: method.id, label: method.name }))}
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
          <label>{t.agreementReference}<RequiredMark /></label>
          <input value={form.agreement_reference} onChange={set("agreement_reference")} required placeholder={t.agreementReferencePlaceholder} />
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
          <label>{t.studentLimit}<RequiredMark /></label>
          <input type="number" min="0" value={form.student_limit} onChange={set("student_limit")} required />
        </div>
        <div>
          <label>{t.instructorLimit}<RequiredMark /></label>
          <input type="number" min="0" value={form.staff_limit} onChange={set("staff_limit")} required />
        </div>
        <div>
          <label>{t.durationDays}<RequiredMark /></label>
          <input type="number" min="1" value={form.access_duration_days} onChange={set("access_duration_days")} required />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
