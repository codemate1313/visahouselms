import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CONFIRM_DIALOG_EVENT, type ConfirmRequest, type ConfirmVariant } from "./confirmDialog";
import { Button } from "./ui/Button/Button";

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
  /* Read through a ref inside the Escape handler so the focus effect below
     depends on `isOpen` alone: keying it to `loading` too tore focus away and
     handed it back to the page behind every time a confirm started or
     finished, mid-dialog. */
  const loadingRef = useRef(loading);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loadingRef.current) onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="premium-modal-backdrop"
      onClick={() => { if (!loading) onClose(); }}
      role="presentation"
    >
      <div
        className="premium-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={`premium-modal-icon is-${variant}`}>
          {variant === "danger" ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          ) : variant === "success" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h2 id={titleId} className="premium-modal-title">{title}</h2>
        <div id={descriptionId} className="premium-modal-description">{message}</div>
        <div className="premium-modal-actions">
          <button
            type="button"
            className="premium-modal-btn cancel-btn"
            onClick={onClose}
            disabled={loading}
            ref={cancelButtonRef}
          >
            {cancelText}
          </button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            className={`premium-modal-btn confirm-btn btn-${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
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
