import { useEffect } from "react";
import { type ToastItem, useToastStore } from "../store/toastStore";

function SnackbarCard({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const duration = toast.durationMs ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, removeToast]);

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };

  return (
    <div className={`snackbar-item snackbar-type-${toast.type}`}>
      <div className={`snackbar-icon-badge snackbar-icon-${toast.type}`}>
        {icons[toast.type]}
      </div>

      <div className="snackbar-text-content">
        {toast.title && <div className="snackbar-title">{toast.title}</div>}
        <div className="snackbar-message">{toast.message}</div>
      </div>

      <button
        type="button"
        className="snackbar-close-btn"
        onClick={() => removeToast(toast.id)}
        aria-label="Close notification"
      >
        ×
      </button>

      <div
        className="snackbar-progress-bar"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

export function GlobalSnackbar() {
  const toasts = useToastStore((s) => s.toasts);

  if (!toasts.length) return null;

  return (
    <div className="global-snackbar-container" aria-live="polite">
      {toasts.map((toast) => (
        <SnackbarCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
