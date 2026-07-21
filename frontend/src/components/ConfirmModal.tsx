import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CONFIRM_DIALOG_EVENT, type ConfirmRequest, type ConfirmVariant } from "./confirmDialog";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, loading]);

  if (!isOpen) return null;

  return (
    <div
      className="logout-modal-backdrop"
      onClick={() => { if (!loading) onClose(); }}
      role="presentation"
    >
      <div
        className="logout-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={`confirm-modal-icon is-${variant}`}>
          {variant === "danger" ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h2 id={titleId} className="logout-modal-title">{title}</h2>
        <div id={descriptionId} className="logout-modal-description">{message}</div>
        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-modal-btn cancel-btn"
            onClick={onClose}
            disabled={loading}
            ref={cancelButtonRef}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`logout-modal-btn confirm-btn btn-${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalConfirmModal() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const customEvt = event as CustomEvent<ConfirmRequest>;
      if (customEvt.detail) {
        setRequest(customEvt.detail);
      }
    };

    window.addEventListener(CONFIRM_DIALOG_EVENT, handleEvent);
    return () => window.removeEventListener(CONFIRM_DIALOG_EVENT, handleEvent);
  }, []);

  if (!request) return null;

  return (
    <ConfirmModal
      isOpen={Boolean(request)}
      title={request.title}
      message={request.message}
      confirmText={request.confirmText}
      cancelText={request.cancelText}
      variant={request.variant}
      onConfirm={() => {
        request.resolve(true);
        setRequest(null);
      }}
      onClose={() => {
        request.resolve(false);
        setRequest(null);
      }}
    />
  );
}
