import { RequiredMark } from "@/components/ui";

interface ProfileContactFieldsProps {
  idPrefix: string;
  dob: string;
  onDobChange: (value: string) => void;
  gender: string;
  onGenderChange: (value: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
}

const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

/** Date of birth, gender, phone, and address fields shared by every role's
 *  "My Profile" page, on top of the name/email fields each page already has. */
export function ProfileContactFields({
  idPrefix,
  dob,
  onDobChange,
  gender,
  onGenderChange,
  phoneNumber,
  onPhoneNumberChange,
  address,
  onAddressChange,
}: ProfileContactFieldsProps) {
  return (
    <>
      <div className="form-grid">
        <div>
          <label htmlFor={`${idPrefix}-dob`}>Date of Birth</label>
          <input
            id={`${idPrefix}-dob`}
            type="date"
            value={dob}
            onChange={(event) => onDobChange(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-gender`}>Gender</label>
          <select
            id={`${idPrefix}-gender`}
            value={gender}
            onChange={(event) => onGenderChange(event.target.value)}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor={`${idPrefix}-phone`}>Phone Number<RequiredMark /></label>
      <input
        id={`${idPrefix}-phone`}
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phoneNumber}
        onChange={(event) => onPhoneNumberChange(event.target.value)}
        required
      />

      <label htmlFor={`${idPrefix}-address`}>Address</label>
      <input
        id={`${idPrefix}-address`}
        type="text"
        placeholder="123 Main Street, Suite 100"
        value={address}
        onChange={(event) => onAddressChange(event.target.value)}
      />
    </>
  );
}
