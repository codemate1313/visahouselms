import { useId, useState, type ReactNode } from "react";
import { Icon } from "./icons";

interface CollapsiblePanelProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export function CollapsiblePanel({
  title,
  description,
  eyebrow,
  badge,
  actions,
  children,
  className,
  contentClassName,
  defaultOpen = true,
  collapsible = false,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  const isCollapsible = collapsible;
  const isOpen = isCollapsible ? open : true;

  return (
    <section className={`collapsible-panel ${isOpen ? "is-open" : "is-closed"} ${className ?? ""}`}>
      <header className="collapsible-panel-header">
        {isCollapsible ? (
          <button
            type="button"
            className="collapsible-panel-toggle"
            aria-expanded={isOpen}
            aria-controls={contentId}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="collapsible-panel-copy">
              {eyebrow && <span className="collapsible-panel-eyebrow">{eyebrow}</span>}
              <span className="collapsible-panel-title-row">
                <span className="collapsible-panel-title">{title}</span>
                {badge && <span className="collapsible-panel-badge">{badge}</span>}
              </span>
              {description && <span className="collapsible-panel-description">{description}</span>}
            </span>
            <span className="collapsible-panel-chevron" aria-hidden="true">
              <Icon name="chevronDown" />
            </span>
          </button>
        ) : (
          <div className="collapsible-panel-static-header">
            <span className="collapsible-panel-copy">
              {eyebrow && <span className="collapsible-panel-eyebrow">{eyebrow}</span>}
              <span className="collapsible-panel-title-row">
                <span className="collapsible-panel-title">{title}</span>
                {badge && <span className="collapsible-panel-badge">{badge}</span>}
              </span>
              {description && <span className="collapsible-panel-description">{description}</span>}
            </span>
          </div>
        )}
        {actions && <div className="collapsible-panel-actions">{actions}</div>}
      </header>

      <div id={contentId} className="collapsible-panel-content" aria-hidden={!isOpen}>
        <div className={`collapsible-panel-inner ${contentClassName ?? ""}`}>{children}</div>
      </div>
    </section>
  );
}
