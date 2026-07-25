import { useState } from "react";
import { blogFormCategories, superAdminBlogFormStrings as strings } from "../SuperAdminBlogForm.strings";
import type { BlogFormData } from "../types";

interface MediaMetadataPanelProps {
  formData: BlogFormData;
  onFieldChange: <K extends keyof BlogFormData>(field: K, value: BlogFormData[K]) => void;
}

export function MediaMetadataPanel({ formData, onFieldChange }: MediaMetadataPanelProps) {
  const [imgError, setImgError] = useState(false);
  const t = strings.fields;

  return (
    <div className="sab-form-side-card">
      <div className="sab-field-group">
        <label>{t.coverPreview}</label>
        <div className="sab-image-preview-container">
          {formData.featured_image_url && !imgError ? (
            <img src={formData.featured_image_url} alt="Cover preview" className="sab-image-preview-img" onError={() => setImgError(true)} />
          ) : (
            <div className="sab-image-preview-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{t.noImagePreview}</span>
            </div>
          )}
        </div>
      </div>

      <div className="sab-field-group">
        <label>{t.featuredImageUrl}</label>
        <input
          type="url"
          value={formData.featured_image_url || ""}
          onChange={(e) => {
            setImgError(false);
            onFieldChange("featured_image_url", e.target.value);
          }}
          className="sab-input-field"
          placeholder={t.featuredImageUrlPlaceholder}
        />
      </div>

      <div className="sab-field-group">
        <label>{t.category}</label>
        <select value={formData.category} onChange={(e) => onFieldChange("category", e.target.value)} className="sab-input-field">
          {blogFormCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="sab-field-group">
        <label>{t.authorName}</label>
        <input type="text" value={formData.author_name} onChange={(e) => onFieldChange("author_name", e.target.value)} className="sab-input-field" />
      </div>

      <div className="sab-field-group">
        <label>{t.readTime}</label>
        <input
          type="number"
          min="1"
          value={formData.read_time_minutes}
          onChange={(e) => onFieldChange("read_time_minutes", parseInt(e.target.value) || 5)}
          className="sab-input-field"
        />
      </div>

      <div className="sab-publish-switch-group">
        <div className="sab-publish-label">
          <strong>{t.publishStatus}</strong>
          <span>{formData.is_published ? t.publishStatusLive : t.publishStatusDraft}</span>
        </div>
        <input
          type="checkbox"
          checked={formData.is_published}
          onChange={(e) => onFieldChange("is_published", e.target.checked)}
          style={{ width: "20px", height: "20px", accentColor: "#e11d2e", cursor: "pointer" }}
        />
      </div>

      <div className="sab-seo-card">
        <h3>{t.seoSectionTitle}</h3>
        <div className="sab-field-group">
          <label>{t.seoTitleTag}</label>
          <input
            type="text"
            value={formData.meta_title || ""}
            onChange={(e) => onFieldChange("meta_title", e.target.value)}
            className="sab-input-field"
            placeholder={t.seoTitleTagPlaceholder}
          />
        </div>

        <div className="sab-field-group">
          <label>{t.tags}</label>
          <input
            type="text"
            value={formData.tags || ""}
            onChange={(e) => onFieldChange("tags", e.target.value)}
            className="sab-input-field"
            placeholder={t.tagsPlaceholder}
          />
        </div>

        <div className="sab-field-group">
          <label>{t.seoMetaDescription}</label>
          <textarea
            rows={2}
            value={formData.meta_description || ""}
            onChange={(e) => onFieldChange("meta_description", e.target.value)}
            className="sab-input-field sab-textarea-field"
            placeholder={t.seoMetaDescriptionPlaceholder}
          />
        </div>
      </div>
    </div>
  );
}
