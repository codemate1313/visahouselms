import type { ChangeEvent, FormEvent } from "react";
import { RequiredMark } from "@/components/ui";
import { instituteMemberFormStrings as strings } from "../InstituteMemberForm.strings";

interface MemberFormFieldsProps {
  isNew: boolean;
  label: string;
  form: { email: string; first_name: string; last_name: string; phone_number: string; address: string };
  saving: boolean;
  error: string | null;
  onFieldChange: (field: "email" | "first_name" | "last_name" | "phone_number" | "address") => (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}

export function MemberFormFields({ isNew, label, form, saving, error, onFieldChange, onSubmit, onCancel }: MemberFormFieldsProps) {
  const f = strings.fields;
  return (
    <div>
      <h1>{isNew ? strings.addTitle(label) : strings.editTitle(label)}</h1>
      <form className="form-card wide" onSubmit={onSubmit}>
        <div className="form-grid">
          <div><label htmlFor="first_name">{f.firstName}<RequiredMark /></label><input id="first_name" value={form.first_name} onChange={onFieldChange("first_name")} required /></div>
          <div><label htmlFor="last_name">{f.lastName}<RequiredMark /></label><input id="last_name" value={form.last_name} onChange={onFieldChange("last_name")} required /></div>
        </div>
        <label htmlFor="email">{f.email}<RequiredMark /></label><input id="email" type="email" value={form.email} onChange={onFieldChange("email")} required />
        <label htmlFor="phone_number">{f.phoneNumber}<RequiredMark /></label><input id="phone_number" value={form.phone_number} onChange={onFieldChange("phone_number")} required />
        <label htmlFor="address">{f.address}</label><input id="address" value={form.address} onChange={onFieldChange("address")} />
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? strings.actions.saving : strings.actions.save(label)}</button>
          <button type="button" onClick={onCancel}>{strings.actions.cancel}</button>
        </div>
      </form>
    </div>
  );
}
