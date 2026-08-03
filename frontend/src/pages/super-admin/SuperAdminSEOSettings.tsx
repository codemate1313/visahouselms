import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { RequiredMark } from "@/components/ui";
import { seoSettingsStrings as strings } from "./SuperAdminSEOSettings.strings";
import { Icon } from "@/components/icons";

export function SuperAdminSEOSettings() {
  const [formData, setFormData] = useState(strings.defaults);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    apiClient
      .get("/super-admin/seo-settings")
      .then(({ data }) => {
        if (data) setFormData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    apiClient
      .put("/super-admin/seo-settings", formData)
      .then(() => {
        setSaving(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      })
      .catch(() => setSaving(false));
  };

  if (loading) {
    return <p className="hint">{strings.loading}</p>;
  }

  return (
    <div>
      {savedSuccess && (
        <p className="success-text" style={{ marginBottom: 16 }}>
          <Icon name="check" /> {strings.savedBanner}
        </p>
      )}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            {strings.heading}
          </h2>
          <p className="hint" style={{ margin: 0 }}>
            {strings.subheading}
          </p>
        </div>

        {/* Section 1: Site & Document Metadata */}
        <div style={{ marginBottom: 28 }}>
          <h3
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary)",
              marginBottom: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
            }}
          >
            Site & Document Metadata
          </h3>
          <div className="form-grid">
            <div>
              <label>
                {strings.fields.siteName} <RequiredMark />
              </label>
              <input
                type="text"
                required
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
              />
            </div>

            <div>
              <label>
                {strings.fields.titleTemplate} <RequiredMark />
              </label>
              <input
                type="text"
                required
                value={formData.title_template}
                onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
                style={{ fontFamily: "monospace" }}
              />
              <span className="hint" style={{ display: "block", marginTop: 4, fontSize: 11.5 }}>
                {strings.fields.titleTemplateHint}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>
              {strings.fields.defaultTitle} <RequiredMark />
            </label>
            <input
              type="text"
              required
              value={formData.default_title}
              onChange={(e) => setFormData({ ...formData, default_title: e.target.value })}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label>
              {strings.fields.metaDescription} <RequiredMark />
            </label>
            <textarea
              required
              rows={3}
              value={formData.default_meta_description}
              onChange={(e) => setFormData({ ...formData, default_meta_description: e.target.value })}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label>{strings.fields.metaKeywords}</label>
            <textarea
              rows={2}
              value={formData.default_meta_keywords}
              onChange={(e) => setFormData({ ...formData, default_meta_keywords: e.target.value })}
            />
          </div>
        </div>

        {/* Section 2: Social Share & OpenGraph */}
        <div style={{ marginBottom: 28 }}>
          <h3
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary)",
              marginBottom: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
            }}
          >
            Social Share & OpenGraph
          </h3>
          <div className="form-grid">
            <div>
              <label>{strings.fields.ogImage}</label>
              <input
                type="text"
                value={formData.default_og_image || ""}
                onChange={(e) => setFormData({ ...formData, default_og_image: e.target.value })}
              />
            </div>

            <div>
              <label>{strings.fields.twitterHandle}</label>
              <input
                type="text"
                value={formData.twitter_handle || ""}
                onChange={(e) => setFormData({ ...formData, twitter_handle: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Search Crawling & Indexing */}
        <div style={{ marginBottom: 24 }}>
          <h3
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--primary)",
              marginBottom: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
            }}
          >
            Search Crawling & Indexing
          </h3>
          <div>
            <label>{strings.fields.robotsTxt}</label>
            <textarea
              rows={3}
              value={formData.robots_txt || ""}
              onChange={(e) => setFormData({ ...formData, robots_txt: e.target.value })}
              style={{ fontFamily: "monospace" }}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? strings.saveBusy : strings.saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
