import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { IconButton } from "../IconButton";
import "./Modal.css";

export interface ModalProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  /**
   * Guard invoked before an Escape press, outside click, or the header close
   * button take effect. Return `false` to block the close (e.g. to protect
   * unsaved input) - anything else, including `undefined`, lets it proceed.
   */
  onBeforeClose?: () => boolean | void;
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
  onBeforeClose,
  onClose,
  open,
  size = "md",
  title,
}: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onBeforeCloseRef = useRef(onBeforeClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onBeforeCloseRef.current = onBeforeClose;
  }, [onBeforeClose]);

  function attemptClose() {
    if (onBeforeCloseRef.current?.() === false) return;
    onCloseRef.current();
  }

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const releaseScroll = lockBodyScroll();
    cardRef.current?.focus();

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") attemptClose();
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      releaseScroll();
      previousFocus?.focus();
    };
  }, [open]);

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !cardRef.current) return;
    const focusable = Array.from(
      cardRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      cardRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="ui-modal-backdrop" role="presentation" onClick={attemptClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ui-modal-card ui-modal-${size}${className ? ` ${className}` : ""}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
        ref={cardRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="ui-modal-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton
            icon={<Icon name="x" />}
            label={closeLabel}
            onClick={attemptClose}
            showTooltip={false}
            size="sm"
            variant="plain"
          />
        </header>
        <div className="ui-modal-body">{children}</div>
        {actions && <footer className="ui-modal-actions">{actions}</footer>}
      </section>
    </div>,
    document.body,
  );
}
