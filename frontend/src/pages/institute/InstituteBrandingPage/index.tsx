import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, PageHeader } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { writeCachedBranding, applyBrandingVariables } from "@/hooks/useInstituteBranding";
import { isEqual } from "@/utils/isEqual";
import { instituteBrandingStrings as strings } from "./InstituteBranding.strings";

interface Branding {
  institute_id: number;
  institute_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  heading_font_weight: number;
  body_font_weight: number;
}

/**
 * An institute admin editing their own institute's branding.
 *
 * Scoped by the session rather than by an id in the URL, so there is no
 * institute to get wrong. The server refuses these calls without a live
 * subscription - an institute with no plan has no students to show a logo to.
 */
export function InstituteBrandingPage() {
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showInfo = useToastStore((state) => state.showInfo);
  const fileInput = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<Branding | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const originalRef = useRef<Branding | null>(null);

  useEffect(() => {
    apiClient
      .get<Branding>("/institute/branding")
      .then(({ data }) => {
        setBranding(data);
        originalRef.current = data;
        setLoadError(null);
      })
      .catch((err: unknown) => setLoadError(extractErrorMessage(err, strings.errors.load)));
  }, []);

  function set<K extends keyof Branding>(field: K, value: Branding[K]) {
    setBranding((current) => (current ? { ...current, [field]: value } : current));
  }

  async function save() {
    if (!branding) return;
    const payload = {
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      font_family: branding.font_family,
      heading_font_weight: branding.heading_font_weight,
      body_font_weight: branding.body_font_weight,
    };
    if (
      originalRef.current &&
      isEqual(
        {
          primary_color: originalRef.current.primary_color,
          secondary_color: originalRef.current.secondary_color,
          font_family: originalRef.current.font_family,
          heading_font_weight: originalRef.current.heading_font_weight,
          body_font_weight: originalRef.current.body_font_weight,
        },
        payload
      )
    ) {
      showInfo(noChangesMessage);
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.put<Branding>("/institute/branding", payload);
      setBranding(data);
      originalRef.current = data;
      if (user?.institute_slug) {
        writeCachedBranding(user.institute_slug, data);
        applyBrandingVariables(data);
      }
      showSuccess(strings.saved);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await apiClient.post<Branding>("/institute/branding/logo", body);
      setBranding(data);
      if (user?.institute_slug) {
        writeCachedBranding(user.institute_slug, data);
        applyBrandingVariables(data);
      }
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.logo));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loadError) return <p className="error-text">{loadError}</p>;
  if (!branding) return <p>{strings.loading}</p>;

  const f = strings.fields;

  return (
    <div>
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      <section className="form-card wide">
        <div className="form-grid">
          <div>
            <label htmlFor="primary-colour">{f.primary}</label>
            <input
              id="primary-colour"
              className="branding-colour-input"
              type="color"
              value={branding.primary_color}
              onChange={(event) => set("primary_color", event.target.value)}
            />
            <small className="hint">{f.primaryHint}</small>
          </div>
          <div>
            <label htmlFor="secondary-colour">{f.secondary}</label>
            <input
              id="secondary-colour"
              className="branding-colour-input"
              type="color"
              value={branding.secondary_color}
              onChange={(event) => set("secondary_color", event.target.value)}
            />
            <small className="hint">{f.secondaryHint}</small>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label htmlFor="font-family">{f.font}</label>
            <select
              id="font-family"
              value={branding.font_family}
              onChange={(event) => set("font_family", event.target.value)}
            >
              {strings.fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="heading-weight">{f.headingWeight}</label>
            <select
              id="heading-weight"
              value={branding.heading_font_weight}
              onChange={(event) => set("heading_font_weight", Number(event.target.value))}
            >
              {strings.weights.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="body-weight">{f.bodyWeight}</label>
            <select
              id="body-weight"
              value={branding.body_font_weight}
              onChange={(event) => set("body_font_weight", Number(event.target.value))}
            >
              {strings.weights.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>{f.logo}</label>
        <div className="branding-logo-row">
          {branding.logo_url && <img className="branding-logo-preview" src={branding.logo_url} alt="" />}
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <small className="hint">{uploading ? f.uploading : f.logoHint}</small>
          </div>
        </div>

        {/* Colours are hard to judge as hex values, so they are shown doing the
            job they will actually do. */}
        <div
          className="branding-preview"
          style={{
            background: branding.secondary_color,
            fontFamily: `"${branding.font_family}", system-ui, sans-serif`,
          }}
        >
          <span className="branding-preview-label">{strings.preview.heading}</span>
          <strong style={{ fontWeight: branding.heading_font_weight }}>
            {branding.institute_name} — {strings.preview.sample}
          </strong>
          <p style={{ fontWeight: branding.body_font_weight }}>{strings.preview.body}</p>
          <span className="branding-preview-button" style={{ background: branding.primary_color }}>
            {strings.preview.button}
          </span>
        </div>

        <div className="form-actions">
          <Button type="button" variant="primary" onClick={save} loading={saving} disabled={saving}>
            {saving ? strings.saving : strings.save}
          </Button>
        </div>
      </section>
    </div>
  );
}
