import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { IconButton } from "../IconButton";
import "./Modal.css";

export interface ModalProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  onClose: () => void;
  open: boolean;
  size?: "sm" | "md" | "lg";
  title: ReactNode;
}

export function Modal({
  actions,
  children,
  className = "",
  closeLabel = "Close",
  onClose,
  open,
  size = "md",
  title,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className={`ui-modal-card ui-modal-${size}${className ? ` ${className}` : ""}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ui-modal-header">
          <h2>{title}</h2>
          <IconButton icon={<Icon name="x" />} label={closeLabel} onClick={onClose} size="sm" variant="plain" />
        </header>
        <div className="ui-modal-body">{children}</div>
        {actions && <footer className="ui-modal-actions">{actions}</footer>}
      </section>
    </div>
  );
}
