import { useEffect } from "react";
import { Button, Modal } from "@/components/ui";
import { useDialogStore } from "../store/dialogStore";

export function GlobalDialog() {
  const { isOpen, options, hideDialog } = useDialogStore();

  useEffect(() => {
    if (!isOpen || !options?.autoCloseMs) return;
    const timer = setTimeout(() => {
      hideDialog();
    }, options.autoCloseMs);
    return () => clearTimeout(timer);
  }, [isOpen, options, hideDialog]);

  if (!isOpen || !options) return null;

  const { type, title, message, confirmText = "OK", onConfirm } = options;

  function handleConfirm() {
    if (onConfirm) onConfirm();
    hideDialog();
  }

  const icons = {
    success: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    warning: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };

  return (
    <Modal
      open
      onClose={hideDialog}
      title={title || type.toUpperCase()}
      size="sm"
      className={`custom-dialog-modal dialog-type-${type}`}
      actions={
        <Button type="button" className={`custom-dialog-btn btn-theme-${type}`} onClick={handleConfirm}>
          {confirmText}
        </Button>
      }
    >
      <div className={`custom-dialog-icon-wrapper icon-theme-${type}`}>
        {icons[type]}
      </div>
      <div className="custom-dialog-content">
        <p className="custom-dialog-message">{message}</p>
      </div>
      {options.autoCloseMs && (
        <div
          className="custom-dialog-progress"
          style={{ animationDuration: `${options.autoCloseMs}ms` }}
        />
      )}
    </Modal>
  );
}
