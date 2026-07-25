import type { FormEvent } from "react";
import { paymentMethodsStrings as strings } from "../PaymentMethods.strings";

interface AddMethodFormProps {
  name: string;
  onNameChange: (value: string) => void;
  saving: boolean;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
}

export function AddMethodForm({ name, onNameChange, saving, error, onSubmit }: AddMethodFormProps) {
  const t = strings.addForm;
  return (
    <form className="form-card wide onboarding-section-card" onSubmit={onSubmit} style={{ marginBottom: 24, maxWidth: 500 }}>
      <h2>{t.heading}</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="name">{t.nameLabel}</label>
          <input id="name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={t.namePlaceholder} required />
        </div>
        <button type="submit" className="primary-submit-btn" disabled={saving} style={{ height: 42, padding: "0 22px" }}>
          {saving ? t.adding : t.addMethod}
        </button>
      </div>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </form>
  );
}
