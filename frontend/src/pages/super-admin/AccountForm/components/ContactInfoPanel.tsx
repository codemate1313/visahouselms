import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { accountFormStrings as strings } from "../AccountForm.strings";

interface ContactInfoPanelProps {
  dob: string;
  onDobChange: (value: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
}

export function ContactInfoPanel({ dob, onDobChange, phoneNumber, onPhoneNumberChange, address, onAddressChange }: ContactInfoPanelProps) {
  const t = strings.contactInfo;
  return (
    <CollapsiblePanel className="account-form-section" title={t.title} description={t.description}>
      <div className="account-field-grid">
        <div>
          <label htmlFor="dob">{t.dob}</label>
          <input id="dob" type="date" value={dob} onChange={(event) => onDobChange(event.target.value)} />
        </div>

        <div>
          <label htmlFor="phone">{t.phone}</label>
          <input id="phone" type="tel" placeholder={t.phonePlaceholder} value={phoneNumber} onChange={(event) => onPhoneNumberChange(event.target.value)} />
        </div>

        <div className="field-wide">
          <label htmlFor="address">{t.address}</label>
          <input id="address" type="text" placeholder={t.addressPlaceholder} value={address} onChange={(event) => onAddressChange(event.target.value)} />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
