import type { FormEvent } from "react";
import { RequiredMark, SearchableSelect, Button } from "@/components/ui";
import { formatCurrencyAmount } from "@/utils/currency";
import { paymentsStrings as strings } from "../Payments.strings";
import type { MethodRow, PaymentRow } from "../types";

interface DuePaymentModalProps {
  dueFor: PaymentRow;
  methods: MethodRow[];
  dueAmount: string;
  onDueAmountChange: (value: string) => void;
  dueMethodId: string;
  onDueMethodIdChange: (value: string) => void;
  dueReference: string;
  onDueReferenceChange: (value: string) => void;
  dueError: string | null;
  dueSaving: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

export function DuePaymentModal({
  dueFor,
  methods,
  dueAmount,
  onDueAmountChange,
  dueMethodId,
  onDueMethodIdChange,
  dueReference,
  onDueReferenceChange,
  dueError,
  dueSaving,
  onSubmit,
  onClose,
}: DuePaymentModalProps) {
  const t = strings.dueModal;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t.heading}</h2>
        <p className="hint">
          {dueFor.institute_name} — {dueFor.invoice_number} — {t.duePrefix} {formatCurrencyAmount(dueFor.due_amount, dueFor.currency)}
        </p>
        <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
          <label htmlFor="due_amount">{t.amountLabel}<RequiredMark /></label>
          <input
            id="due_amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={dueAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/,/g, ".");
              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                onDueAmountChange(val);
              }
            }}
            placeholder="0.00"
            required
          />
          <p className="hint" style={{ marginTop: 4 }}>
            {t.remainingAfterPrefix} {formatCurrencyAmount(
              Math.max(0, Number(String(dueFor.due_amount).replace(/,/g, ".")) - (Number(String(dueAmount).replace(/,/g, ".")) || 0)),
              dueFor.currency,
            )}
          </p>
          <label htmlFor="due_method" style={{ marginTop: 12 }}>
            {t.methodLabel}
          </label>
          <SearchableSelect
            id="due_method"
            options={[{ value: "", label: t.selectMode }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
            value={dueMethodId}
            onChange={(value) => onDueMethodIdChange(String(value))}
            searchPlaceholder={t.searchModes}
            className="form-dropdown-select"
          />
          <label htmlFor="due_reference" style={{ marginTop: 12 }}>
            {t.referenceLabel}
          </label>
          <input id="due_reference" value={dueReference} onChange={(e) => onDueReferenceChange(e.target.value)} placeholder={t.referencePlaceholder} />

          {dueError && <p className="error-text" style={{ marginTop: 12 }}>{dueError}</p>}

          <div className="form-actions" style={{ marginTop: 20 }}>
            <Button type="submit" variant="primary" loading={dueSaving} disabled={dueSaving}>
              {dueSaving ? strings.recordForm.recording : strings.recordForm.submit}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={dueSaving}>
              {strings.cancel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
