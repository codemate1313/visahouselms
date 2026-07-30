import type { ReactNode } from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  appearance?: "standard" | "compact";
  className?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Title + subtitle on the left, action buttons on the right. The recurring
 * header bar shape used at the top of almost every portal screen. */
export function PageHeader({
  actions,
  appearance = "standard",
  className = "",
  eyebrow,
  subtitle,
  title,
}: PageHeaderProps) {
  const compact = appearance === "compact";
  const rootClass = [compact ? "ui-page-header" : "page-header", className].filter(Boolean).join(" ");
  const textClass = compact ? "ui-page-header-text" : undefined;
  const actionsClass = compact ? "ui-page-header-actions" : "page-header-actions";

  return (
    <div className={rootClass}>
      <div className={textClass}>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p className={compact ? undefined : "page-subtitle"}>{subtitle}</p>}
      </div>
      {actions && <div className={actionsClass}>{actions}</div>}
    </div>
  );
}
