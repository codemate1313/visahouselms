import { superAdminBlogFormStrings as strings } from "../SuperAdminBlogForm.strings";
import type { BlogFormData } from "../types";

interface MainContentFieldsProps {
  formData: BlogFormData;
  onTitleChange: (title: string) => void;
  onFieldChange: <K extends keyof BlogFormData>(field: K, value: BlogFormData[K]) => void;
}

export function MainContentFields({ formData, onTitleChange, onFieldChange }: MainContentFieldsProps) {
  const t = strings.fields;
  return (
    <div className="sab-form-main-card">
      <div className="sab-field-group">
        <label>
          <span>{t.articleTitle}</span>
          {formData.slug && <span className="sab-slug-hint">/{formData.slug}</span>}
        </label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="sab-input-field"
          placeholder={t.articleTitlePlaceholder}
        />
      </div>

      <div className="sab-field-group">
        <label>{t.slug}</label>
        <input
          type="text"
          required
          value={formData.slug}
          onChange={(e) => onFieldChange("slug", e.target.value)}
          className="sab-input-field sab-mono-editor"
          placeholder={t.slugPlaceholder}
        />
      </div>

      <div className="sab-field-group">
        <label>{t.summary}</label>
        <textarea
          required
          rows={3}
          value={formData.summary}
          onChange={(e) => {
            onFieldChange("summary", e.target.value);
            if (!formData.meta_description) onFieldChange("meta_description", e.target.value);
          }}
          className="sab-input-field sab-textarea-field"
          placeholder={t.summaryPlaceholder}
        />
      </div>

      <div className="sab-field-group">
        <label>{t.content}</label>
        <textarea
          required
          rows={14}
          value={formData.content_markdown}
          onChange={(e) => onFieldChange("content_markdown", e.target.value)}
          className="sab-input-field sab-textarea-field sab-mono-editor"
          placeholder={t.contentPlaceholder}
        />
      </div>
    </div>
  );
}
