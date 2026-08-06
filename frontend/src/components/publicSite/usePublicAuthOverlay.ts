import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useLoaderStore } from "@/store/loaderStore";
import { destinationFor } from "@/pages/Login/helpers";
import { lockBodyScroll } from "@/utils/scrollLock";
import type { AuthMode } from "./authOverlayTypes";

/**
 * Drives the login/register modal for `/login` and `/register` — the only
 * two public routes not backed by their own page (both render on top of
 * `Home`, per `router.tsx`). Ported from `StaticDcPage`, which used to own
 * this regardless of which marketing page was "underneath" the iframe.
 */
export function usePublicAuthOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isLoading = useLoaderStore((state) => state.isLoading);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  useEffect(() => {
    const isAuthPath = location.pathname === "/login" || location.pathname === "/register";
    // Already signed in and asking to sign in: the overlay cannot be dismissed
    // by an authenticated user, so opening it would trap them.
    if (isAuthPath && user) {
      setAuthMode(null);
      navigate(destinationFor(user) ?? "/", { replace: true });
      return;
    }
    if (location.pathname === "/login") {
      setAuthMode("login");
    } else if (location.pathname === "/register") {
      setAuthMode("register");
    } else {
      setAuthMode(null);
    }
  }, [location.pathname, navigate, user]);

  const handleClose = useCallback(() => {
    if (user) return;
    navigate("/", { replace: true });
  }, [navigate, user]);

  useEffect(() => {
    if (!authMode) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading && !user) handleClose();
    }

    const releaseScroll = lockBodyScroll();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authMode, handleClose, isLoading, user]);

  return { authMode, setAuthMode, handleClose, user, isLoading };
}
