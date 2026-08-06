import { useAuthStore } from "@/store/authStore";
import { useImpersonationStore } from "@/store/impersonationStore";
import "./ImpersonationBanner.css";

/**
 * The always-on reminder that the current view is someone else's, with the one
 * way out. Restoring the developer's own session is a local swap - the original
 * token was kept when impersonation began - so exiting never needs the network
 * and cannot fail halfway.
 */
export function ImpersonationBanner() {
  const { active, target, originalToken, originalUser, end } = useImpersonationStore();
  const setSession = useAuthStore((s) => s.setSession);

  if (!active || !target) return null;

  function exit() {
    if (originalToken && originalUser) {
      setSession(originalToken, originalUser);
    }
    end();
    // Full reload so every screen re-reads the restored session cleanly.
    window.location.assign("/");
  }

  return (
    <div className="impersonation-banner" role="status">
      <span className="impersonation-banner-text">
        Viewing as <strong>{target.name}</strong> ({target.email}) — read-only.
      </span>
      <button type="button" className="impersonation-banner-exit" onClick={exit}>
        Exit
      </button>
    </div>
  );
}
