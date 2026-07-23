import { type ChangeEvent, type CSSProperties, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { SearchableSelect } from "../../components/SearchableSelect";

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

const FONT_OPTIONS = ["Plus Jakarta Sans", "Inter", "Sora", "Outfit", "system-ui"];
const FONT_WEIGHTS = [400, 500, 600, 700, 800];

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

        <h2 className="section-title" style={{ marginTop: 24 }}>Typography</h2>
        <p className="hint">Applied to the institute admin, instructor, and student portals.</p>
        <div className="form-grid">
          <div>
            <label htmlFor="font-family">Font family</label>
            <SearchableSelect
              id="font-family"
              options={FONT_OPTIONS.map((font) => ({ value: font, label: font === "system-ui" ? "System UI" : font }))}
              value={fontFamily}
              onChange={(value) => setFontFamily(String(value))}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label htmlFor="heading-weight">Heading weight</label>
            <SearchableSelect
              id="heading-weight"
              options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
              value={headingWeight}
              onChange={(value) => setHeadingWeight(Number(value))}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label htmlFor="body-weight">Body weight</label>
            <SearchableSelect
              id="body-weight"
              options={FONT_WEIGHTS.map((weight) => ({ value: weight, label: String(weight) }))}
              value={bodyWeight}
              onChange={(value) => setBodyWeight(Number(value))}
              searchable={false}
              className="form-dropdown-select"
            />
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
          <button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save branding"}</button>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 28 }}>Live preview</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        This is what the institute's own portal will look like once themed with these colors.
      </p>
      <div
        className="branding-dashboard-preview"
        style={{
          "--preview-primary": primary,
          "--preview-secondary": secondary,
          "--preview-on-primary": "var(--white)",
          fontFamily: fontFamily === "system-ui" ? "system-ui" : `'${fontFamily}', sans-serif`,
          fontWeight: bodyWeight,
        } as CSSProperties}
      >
        <div className="branding-preview-sidebar">
          <div className="branding-preview-brand">
            {logoSrc ? <img src={logoSrc} alt="" className="branding-preview-logo" /> : <div className="branding-preview-logo-placeholder" />}
            <div>
              <strong style={{ fontWeight: headingWeight }}>{branding?.institute_name ?? "Institute Portal"}</strong>
              <span>Institute Student</span>
            </div>
          </div>
          <div className="branding-preview-menu">
            <span className="is-active">Dashboard</span>
            <span>My Tests</span>
            <span>My Test History</span>
            <span>Progress</span>
          </div>
          <div className="branding-preview-settings">
            <span>My Profile</span>
            <span>Active Sessions</span>
          </div>
        </div>
        <div className="branding-preview-main">
          <div className="branding-preview-header">
            <div>
              <small>Institute Student Portal</small>
              <h3 style={{ fontWeight: headingWeight }}>Welcome, QA</h3>
              <p>Take assigned tests and track CEFR results.</p>
            </div>
            <button className="branding-preview-button">View assigned tests</button>
          </div>
          <div className="branding-preview-stats">
            <article><span>Available tests</span><strong>6</strong></article>
            <article><span>In progress</span><strong>0</strong></article>
            <article><span>Awaiting grading</span><strong>12</strong></article>
            <article><span>Graded</span><strong>1</strong></article>
          </div>
          <div className="branding-preview-panels">
            <section>
              <h4>Institute assigned tests</h4>
              <p>Only tests allotted to your institute are available here.</p>
              <div className="branding-preview-panel-row"><span>Available now</span><strong>6 tests</strong></div>
              <button className="branding-preview-text-button">Go to My Tests</button>
            </section>
            <section>
              <h4>Recent test activity</h4>
              {["Sample Full Mock Test", "Sample Final Test", "Sample Reading Course"].map((item) => (
                <div className="branding-preview-activity" key={item}>
                  <span>{item}</span>
                  <small>Awaiting grading</small>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
