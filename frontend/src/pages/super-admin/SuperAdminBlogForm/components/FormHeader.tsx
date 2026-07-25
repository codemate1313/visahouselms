import { Link } from "react-router-dom";
import { superAdminBlogFormStrings as strings } from "../SuperAdminBlogForm.strings";

interface FormHeaderProps {
  isEdit: boolean;
  loading: boolean;
}

export function FormHeader({ isEdit, loading }: FormHeaderProps) {
  return (
    <div className="sab-form-header">
      <div className="sab-form-header-left">
        <Link to="/super-admin/blogs" className="sab-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{strings.backToArticles}</span>
        </Link>
        <div className="sab-form-title-group">
          <h1>{isEdit ? strings.editTitle : strings.createTitle}</h1>
          <p>{strings.subtitle}</p>
        </div>
      </div>

      <div className="sab-form-header-actions">
        <Link to="/super-admin/blogs" className="sat-btn sat-btn-secondary">
          {strings.cancel}
        </Link>
        <button type="submit" form="blog-article-form" disabled={loading} className="sat-btn sat-btn-primary">
          {loading ? strings.saveBusy : isEdit ? strings.updateLabel : strings.publishLabel}
        </button>
      </div>
    </div>
  );
}
