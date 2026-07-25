import type { ReactNode } from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Title + subtitle on the left, action buttons on the right. The recurring
 * header bar shape used at the top of almost every portal screen. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header-actions">{actions}</div>}
    </div>
  );
}
