import { type MouseEvent } from "react";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { staticDcPageStrings as strings } from "../StaticDcPage.strings";
import type { AuthMode, PublicTheme } from "../types";

interface AuthOverlayProps {
  authMode: AuthMode;
  publicTheme: PublicTheme;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  closeDisabled?: boolean;
}

export function AuthOverlay({ authMode, publicTheme, onClose, onModeChange, closeDisabled = false }: AuthOverlayProps) {
  function handleClose() {
    if (closeDisabled) return;
    onClose();
  }

  function handleModalClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a");
    const href = link?.getAttribute("href");
    if (href === "/login") {
      event.preventDefault();
      onModeChange("login");
    }
    if (href === "/register") {
      event.preventDefault();
      onModeChange("register");
    }
  }

  return (
    <div
      className={`login-modal-overlay static-auth-modal static-auth-modal-${publicTheme}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="login-modal-wrapper static-auth-modal-wrapper"
        onClick={(event) => {
          event.stopPropagation();
          handleModalClick(event);
        }}
      >
        <button
          type="button"
          className="login-modal-close-btn"
          onClick={handleClose}
          disabled={closeDisabled}
          aria-label={strings.authOverlay.closeAriaLabel}
          title={strings.authOverlay.closeTitle}
        >
          {strings.authOverlay.closeGlyph}
        </button>
        {authMode === "login" ? <Login disableAnimation={true} /> : <Register />}
      </div>
    </div>
  );
}
