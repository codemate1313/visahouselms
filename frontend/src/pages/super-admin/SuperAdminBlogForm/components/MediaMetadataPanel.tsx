import { useRef, useState, type ChangeEvent } from "react";
import { Checkbox, SearchableSelect } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { blogFormCategories, superAdminBlogFormStrings as strings } from "../SuperAdminBlogForm.strings";
import type { BlogFormData } from "../types";

interface MediaMetadataPanelProps {
  formData: BlogFormData;
  onFieldChange: <K extends keyof BlogFormData>(field: K, value: BlogFormData[K]) => void;
}

export function MediaMetadataPanel({ formData, onFieldChange }: MediaMetadataPanelProps) {
  const [imgError, setImgError] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = strings.fields;

  async function handleCoverFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    onFieldChange("featured_image_url", localUrl);
    setUploadingCover(true);
    setCoverUploadError(null);
    setImgError(false);

    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<{ url: string }>("/super-admin/blogs/upload-cover", form);
      onFieldChange("featured_image_url", data.url);
    } catch (err: unknown) {
      setCoverUploadError(extractErrorMessage(err, "Failed to upload cover image"));
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="sab-form-side-card">
      {/* Cover Image Preview & Dropzone */}
      <div className="sab-field-group">
        <label>{t.coverPreview}</label>
        <div
          className="sab-image-preview-container"
          onClick={() => fileInputRef.current?.click()}
          title="Click to choose cover image from files"
        >
          {formData.featured_image_url && !imgError ? (
            <>
              <img
                src={formData.featured_image_url}
                alt="Cover preview"
                className="sab-image-preview-img"
                onError={() => setImgError(true)}
              />
              <div className="sab-image-hover-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Change Image</span>
              </div>
            </>
          ) : (
            <div className="sab-image-preview-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="sab-empty-text-main">
                {uploadingCover ? "Uploading..." : "Click to upload cover image"}
              </span>
              <span className="sab-empty-text-sub">PNG, JPG, WebP supported</span>
            </div>
          )}
          {uploadingCover && (
            <div className="sab-image-loading-overlay">
              <div className="sat-spinner-sm" />
            </div>
          )}
        </div>
      </div>

      {/* Featured Image URL with Browse File Action */}
      <div className="sab-field-group">
        <div className="sab-field-label-row">
          <label>{t.featuredImageUrl}</label>
          {formData.featured_image_url && (
            <Button
              type="button"
              variant="text"
              onClick={() => onFieldChange("featured_image_url", "")}
              className="sab-btn-clear-link"
              title="Clear image URL"
            >
              Clear
            </Button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleCoverFileSelect}
          accept="image/png,image/jpeg,image/webp,image/jpg"
          style={{ display: "none" }}
        />

        <input
          type="text"
          value={formData.featured_image_url || ""}
          onChange={(e) => {
            setImgError(false);
            onFieldChange("featured_image_url", e.target.value);
          }}
          className="sab-input-field"
          placeholder={t.featuredImageUrlPlaceholder}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCover}
          className="sab-choose-file-btn"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{uploadingCover ? "Uploading..." : "Browse from files"}</span>
        </Button>

        {coverUploadError && <span className="sab-upload-error">{coverUploadError}</span>}
      </div>

      <div className="sab-field-group">
        <label>{t.category}</label>
        <SearchableSelect
          ariaLabel={t.category}
          className="sab-input-field"
          options={blogFormCategories.map((category) => ({ value: category, label: category }))}
          searchable={false}
          value={formData.category}
          onChange={(value) => onFieldChange("category", String(value))}
        />
      </div>

      <div className="sab-field-group">
        <label>{t.authorName}</label>
        <input
          type="text"
          value={formData.author_name}
          onChange={(e) => onFieldChange("author_name", e.target.value)}
          className="sab-input-field"
        />
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
        <Checkbox
          size="lg"
          checked={formData.is_published}
          onChange={(e) => onFieldChange("is_published", e.target.checked)}
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
            value={formData.tags}
            onChange={(e) => onFieldChange("tags", e.target.value)}
            className="sab-input-field"
            placeholder={t.tagsPlaceholder}
          />
        </div>

        <div className="sab-field-group">
          <label>{t.seoMetaDescription}</label>
          <textarea
            rows={3}
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
