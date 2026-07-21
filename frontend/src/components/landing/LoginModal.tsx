import { useEffect } from "react";
import { Login } from "../../pages/Login";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="login-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="login-modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Login Component inside Modal */}
        <Login />
      </div>
    </div>
  );
}
