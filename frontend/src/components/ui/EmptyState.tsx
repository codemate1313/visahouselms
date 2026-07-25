import type { ReactNode } from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-state-icon">{icon}</div>}
      <p className="ui-empty-state-title">{title}</p>
      {description && <p className="ui-empty-state-description">{description}</p>}
      {action && <div className="ui-empty-state-action">{action}</div>}
    </div>
  );
}
