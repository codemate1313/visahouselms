import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getOriginalToken, useImpersonationStore } from "@/store/impersonationStore";
import "./ImpersonationBanner.css";

/**
 * The always-on reminder that the current view is someone else's, with the one
 * way out. Restoring the developer's own session is a local swap - the original
 * token was kept in memory when impersonation began - so exiting never needs
 * the network and cannot fail halfway.
 *
 * The tokens live only in memory (never localStorage - see impersonationStore),
 * so a hard refresh loses them and ends impersonation on the next load; the
 * banner calls that out so it isn't a surprise.
 */
export function ImpersonationBanner() {
  const { active, target, originalUser, end } = useImpersonationStore();
  const setSession = useAuthStore((s) => s.setSession);

  // The banner is fixed at the top, so the page has to be pushed down or it
  // sits under the banner. A class on <html> that reserves the banner's height
  // works across every layout, including the full-height portal shells.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-impersonation-banner", active);
    return () => root.classList.remove("has-impersonation-banner");
  }, [active]);

  if (!active || !target) return null;

  function exit() {
    const originalToken = getOriginalToken();
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
        <span className="impersonation-banner-note"> Refreshing this page will end impersonation.</span>
      </span>
      <button type="button" className="impersonation-banner-exit" onClick={exit}>
        Exit
      </button>
    </div>
  );
}
