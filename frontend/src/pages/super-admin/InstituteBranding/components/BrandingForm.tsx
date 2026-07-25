import type { ChangeEvent } from "react";
import { SearchableSelect } from "@/components/ui";
import { instituteBrandingStrings as strings } from "../InstituteBranding.strings";
import { FONT_OPTIONS, FONT_WEIGHTS } from "../types";

interface BrandingFormProps {
  primary: string;
  onPrimaryChange: (value: string) => void;
  secondary: string;
  onSecondaryChange: (value: string) => void;
  fontFamily: string;
  onFontFamilyChange: (value: string) => void;
  headingWeight: number;
  onHeadingWeightChange: (value: number) => void;
  bodyWeight: number;
  onBodyWeightChange: (value: number) => void;
  logoSrc: string | null;
  uploading: boolean;
  onUploadLogo: (event: ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  notice: string | null;
  saving: boolean;
  onSave: () => void;
}

export function BrandingForm({
  primary,
  onPrimaryChange,
  secondary,
  onSecondaryChange,
  fontFamily,
  onFontFamilyChange,
  headingWeight,
  onHeadingWeightChange,
  bodyWeight,
  onBodyWeightChange,
  logoSrc,
  uploading,
  onUploadLogo,
  error,
  notice,
  saving,
  onSave,
}: BrandingFormProps) {
  const t = strings;
  return (
    <div className="form-card wide">
      <div className="form-grid">
        <div>
          <label htmlFor="primary">{t.primaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={primary} onChange={(e) => onPrimaryChange(e.target.value)} />
            <input id="primary" value={primary} onChange={(e) => onPrimaryChange(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="secondary">{t.secondaryColor}</label>
          <div className="color-input-row">
            <input type="color" value={secondary} onChange={(e) => onSecondaryChange(e.target.value)} />
            <input id="secondary" value={secondary} onChange={(e) => onSecondaryChange(e.target.value)} />
          </div>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 24 }}>
        {t.typographyHeading}
      </h2>
      <p className="hint">{t.typographyHint}</p>
      <div className="form-grid">
        <div>
          <label htmlFor="font-family">{t.fontFamily}</label>
          <SearchableSelect
            id="font-family"
            options={FONT_OPTIONS.map((font) => ({ value: font, label: font === "system-ui" ? t.systemUi : font }))}
            value={fontFamily}
            onChange={(value) => onFontFamilyChange(String(value))}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="heading-weight">{t.headingWeight}</label>
          <SearchableSelect
            id="heading-weight"
            options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
            value={headingWeight}
            onChange={(value) => onHeadingWeightChange(Number(value))}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="body-weight">{t.bodyWeight}</label>
          <SearchableSelect
            id="body-weight"
            options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
            value={bodyWeight}
            onChange={(value) => onBodyWeightChange(Number(value))}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
      </div>

      <label>{t.logo}</label>
      <div className="profile-avatar-row" style={{ marginTop: 4 }}>
        {logoSrc ? (
          <img src={logoSrc} alt="Logo" className="avatar-preview" style={{ borderRadius: 8 }} />
        ) : (
          <div className="avatar-preview avatar-initials" style={{ borderRadius: 8 }}>
            ?
          </div>
        )}
        <div>
          <label htmlFor="logo-input" className="avatar-upload-label">
            {uploading ? t.uploading : t.uploadLogo}
          </label>
          <input id="logo-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadLogo} disabled={uploading} hidden />
          <p className="hint">{t.logoHint}</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <div className="form-actions">
        <button onClick={onSave} disabled={saving}>
          {saving ? t.saving : t.saveBranding}
        </button>
      </div>
    </div>
  );
}
