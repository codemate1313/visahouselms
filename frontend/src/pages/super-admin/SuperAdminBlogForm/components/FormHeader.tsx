import { Link, useNavigate, type NavigateFunction } from "react-router-dom";
import { confirmAction } from "@/components/confirmDialog";
import { Button } from "@/components/ui/Button/Button";
import { superAdminBlogFormStrings as strings } from "../SuperAdminBlogForm.strings";

interface FormHeaderProps {
  isEdit: boolean;
  loading: boolean;
  /** Whether the form differs from its pristine snapshot - gates the leave-confirmation. */
  isDirty: boolean;
}

const ARTICLES_PATH = "/super-admin/blogs";

async function guardLeave(event: React.MouseEvent<HTMLAnchorElement>, isDirty: boolean, navigate: NavigateFunction) {
  if (!isDirty) return; // let the Link navigate normally
  event.preventDefault();
  const confirmed = await confirmAction(strings.unsavedChangesMessage, {
    title: strings.unsavedChangesTitle,
    confirmText: "Leave",
    cancelText: "Stay",
    variant: "warning",
  });
  if (confirmed) navigate(ARTICLES_PATH);
}

export function FormHeader({ isEdit, loading, isDirty }: FormHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sab-form-header">
      <div className="sab-form-header-left">
        <Link to={ARTICLES_PATH} className="sab-back-btn" onClick={(event) => void guardLeave(event, isDirty, navigate)}>
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
        <Link to={ARTICLES_PATH} className="sat-btn sat-btn-secondary" onClick={(event) => void guardLeave(event, isDirty, navigate)}>
          {strings.cancel}
        </Link>
        <Button type="submit" form="blog-article-form" disabled={loading} className="sat-btn sat-btn-primary">
          {loading ? strings.saveBusy : isEdit ? strings.updateLabel : strings.publishLabel}
        </Button>
      </div>
    </div>
  );
}
