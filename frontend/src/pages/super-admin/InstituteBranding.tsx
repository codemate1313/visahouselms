import { type ChangeEvent, type CSSProperties, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface Branding {
  institute_id: number;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export function InstituteBranding() {
  const { id } = useParams();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [primary, setPrimary] = useState("#4f46e5");
  const [secondary, setSecondary] = useState("#1e2130");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    apiClient.get(`/super-admin/institutes/${id}/branding`).then(({ data }) => {
      setBranding(data);
      setPrimary(data.primary_color);
      setSecondary(data.secondary_color);
    });
  }, [id]);

  useEffect(load, [load]);

  async function save() {
    setError(null); setNotice(null); setSaving(true);
    try {
      const { data } = await apiClient.put(`/super-admin/institutes/${id}/branding`, {
        primary_color: primary,
        secondary_color: secondary,
      });
      setBranding(data);
      setNotice("Branding saved.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save branding."));
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
      setNotice("Logo uploaded.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to upload logo."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const logoSrc = branding?.logo_url ? `${API_BASE_URL}${branding.logo_url}?t=${Date.now()}` : null;

  return (
    <div>
      <h1>Institute Branding</h1>
      <div className="form-card wide">
        <div className="form-grid">
          <div>
            <label htmlFor="primary">Primary color</label>
            <div className="color-input-row">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              <input id="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="secondary">Secondary color</label>
            <div className="color-input-row">
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
              <input id="secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </div>
        </div>

        <label>Logo</label>
        <div className="profile-avatar-row" style={{ marginTop: 4 }}>
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="avatar-preview" style={{ borderRadius: 8 }} />
          ) : (
            <div className="avatar-preview avatar-initials" style={{ borderRadius: 8 }}>?</div>
          )}
          <div>
            <label htmlFor="logo-input" className="avatar-upload-label">
              {uploading ? "Uploading..." : "Upload logo"}
            </label>
            <input
              id="logo-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadLogo}
              disabled={uploading}
              hidden
            />
            <p className="hint">PNG, JPEG, or WebP. Max 2 MB.</p>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}

        <div className="form-actions">
          <button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Colors"}</button>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 28 }}>Live preview</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        This is what the institute's own portal will look like once themed with these colors.
      </p>
      <div
        className="branding-preview"
        style={{ "--preview-primary": primary, "--preview-secondary": secondary } as CSSProperties}
      >
        <div className="branding-preview-nav">
          {logoSrc ? <img src={logoSrc} alt="" className="branding-preview-logo" /> : <div className="branding-preview-logo-placeholder" />}
          <span>Institute Portal</span>
        </div>
        <div className="branding-preview-body">
          <button className="branding-preview-button">Primary action</button>
          <span className="branding-preview-badge">Sample badge</span>
        </div>
      </div>
    </div>
  );
}
