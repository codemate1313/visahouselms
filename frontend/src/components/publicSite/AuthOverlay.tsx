import { type MouseEvent } from "react";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { authOverlayStrings as strings } from "./authOverlay.strings";
import type { AuthMode, PublicTheme } from "./authOverlayTypes";
import { IconButton } from "@/components/ui/IconButton/IconButton";

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
        <IconButton
          className="login-modal-close-btn"
          onClick={handleClose}
          disabled={closeDisabled}
          showTooltip={false}
          label={strings.authOverlay.closeAriaLabel}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          }
        />
        {authMode === "login" ? <Login allowedRoles={["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT", "SUPER_ADMIN", "SA_INSTRUCTOR"]} disableAnimation={true} /> : <Register />}
      </div>
    </div>
  );
}
