import type { FormEvent } from "react";
import { RequiredMark, SearchableSelect } from "@/components/ui";
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
          {dueFor.institute_name} — {dueFor.invoice_number} — {t.duePrefix} {dueFor.currency || "INR"} {dueFor.due_amount}
        </p>
        <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
          <label htmlFor="due_amount">{t.amountLabel}<RequiredMark /></label>
          <input
            id="due_amount"
            type="number"
            min="0.01"
            step="0.01"
            max={dueFor.due_amount}
            value={dueAmount}
            onChange={(e) => onDueAmountChange(e.target.value)}
            required
          />
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
            <button type="submit" className="primary-submit-btn" disabled={dueSaving}>
              {dueSaving ? strings.recordForm.recording : strings.recordForm.submit}
            </button>
            <button type="button" className="secondary-done-btn" onClick={onClose}>
              {strings.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
