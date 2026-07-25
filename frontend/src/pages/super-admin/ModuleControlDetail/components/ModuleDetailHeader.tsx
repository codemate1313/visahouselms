import { Link } from "react-router-dom";
import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import { formatDate } from "../helpers";
import type { ManagedModule } from "../types";

interface ModuleDetailHeaderProps {
  module: ManagedModule;
}

export function ModuleDetailHeader({ module }: ModuleDetailHeaderProps) {
  return (
    <div className="page-header module-detail-header">
      <div>
        <span className="page-eyebrow">{strings.eyebrow}</span>
        <h1>{module.title}</h1>
        <p className="page-subtitle">
          {strings.createdBy} <strong>{module.created_by_name}</strong> on {formatDate(module.created_at)}
        </p>
      </div>

      <Link to="/super-admin/modules" className="back-link-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {strings.backToCourseTree}
      </Link>
    </div>
  );
}
