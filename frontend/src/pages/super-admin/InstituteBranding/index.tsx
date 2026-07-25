import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { instituteBrandingStrings as strings } from "./InstituteBranding.strings";
import type { Branding } from "./types";
import { BrandingForm } from "./components/BrandingForm";
import { BrandingPreview } from "./components/BrandingPreview";

export function InstituteBranding() {
  const { id } = useParams();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [primary, setPrimary] = useState("#4f46e5");
  const [secondary, setSecondary] = useState("#1e2130");
  const [fontFamily, setFontFamily] = useState("Plus Jakarta Sans");
  const [headingWeight, setHeadingWeight] = useState(700);
  const [bodyWeight, setBodyWeight] = useState(400);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    apiClient.get(`/super-admin/institutes/${id}/branding`).then(({ data }) => {
      setBranding(data);
      setPrimary(data.primary_color);
      setSecondary(data.secondary_color);
      setFontFamily(data.font_family);
      setHeadingWeight(data.heading_font_weight);
      setBodyWeight(data.body_font_weight);
    });
  }, [id]);

  useEffect(load, [load]);

  async function save() {
    setError(null); setNotice(null); setSaving(true);
    try {
      const { data } = await apiClient.put(`/super-admin/institutes/${id}/branding`, {
        primary_color: primary,
        secondary_color: secondary,
        font_family: fontFamily,
        heading_font_weight: headingWeight,
        body_font_weight: bodyWeight,
      });
      setBranding(data);
      setNotice(strings.notices.saved);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null); setNotice(null); setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post(`/super-admin/institutes/${id}/branding/logo`, form);
      setBranding(data);
      setNotice(strings.notices.logoUploaded);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.uploadLogo));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const logoSrc = branding?.logo_url ? `${API_BASE_URL}${branding.logo_url}?t=${Date.now()}` : null;

  return (
    <div>
      <h1>{strings.title}</h1>
      <BrandingForm
        primary={primary}
        onPrimaryChange={setPrimary}
        secondary={secondary}
        onSecondaryChange={setSecondary}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        headingWeight={headingWeight}
        onHeadingWeightChange={setHeadingWeight}
        bodyWeight={bodyWeight}
        onBodyWeightChange={setBodyWeight}
        logoSrc={logoSrc}
        uploading={uploading}
        onUploadLogo={uploadLogo}
        error={error}
        notice={notice}
        saving={saving}
        onSave={save}
      />

      <h2 className="section-title" style={{ marginTop: 28 }}>
        {strings.livePreviewHeading}
      </h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        {strings.livePreviewHint}
      </p>
      <BrandingPreview
        primary={primary}
        secondary={secondary}
        fontFamily={fontFamily}
        headingWeight={headingWeight}
        bodyWeight={bodyWeight}
        logoSrc={logoSrc}
        instituteName={branding?.institute_name}
      />
    </div>
  );
}
