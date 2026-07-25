import { RequiredMark } from "@/components/ui";
import { instituteFormStrings as strings } from "../InstituteForm.strings";

interface AdminAccountFieldsProps {
  adminEmail: string;
  onAdminEmailChange: (value: string) => void;
  adminFirstName: string;
  onAdminFirstNameChange: (value: string) => void;
  adminLastName: string;
  onAdminLastNameChange: (value: string) => void;
}

export function AdminAccountFields({
  adminEmail,
  onAdminEmailChange,
  adminFirstName,
  onAdminFirstNameChange,
  adminLastName,
  onAdminLastNameChange,
}: AdminAccountFieldsProps) {
  return (
    <>
      <p className="section-title" style={{ marginTop: 20 }}>
        {strings.firstAdminHeading}
      </p>
      <label htmlFor="admin_email">{strings.adminEmailLabel}<RequiredMark /></label>
      <input id="admin_email" type="email" value={adminEmail} onChange={(e) => onAdminEmailChange(e.target.value)} required />
      <div className="form-grid">
        <div>
          <label htmlFor="admin_first_name">{strings.firstNameLabel}<RequiredMark /></label>
          <input id="admin_first_name" value={adminFirstName} onChange={(e) => onAdminFirstNameChange(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="admin_last_name">{strings.lastNameLabel}<RequiredMark /></label>
          <input id="admin_last_name" value={adminLastName} onChange={(e) => onAdminLastNameChange(e.target.value)} required />
        </div>
      </div>
      <p className="hint">{strings.passwordHint}</p>
    </>
  );
}
