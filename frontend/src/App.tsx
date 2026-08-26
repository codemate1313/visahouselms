import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { initializeSession } from "./api/client";
import { ConnectivityNotice } from "./components/ConnectivityNotice";
import { GlobalConfirmModal } from "./components/ConfirmModal";
import { GlobalDialog } from "./components/GlobalDialog";
import { GlobalLoader } from "./components/GlobalLoader";
import { GlobalSnackbar } from "./components/GlobalSnackbar";
import { GsapInteractionLayer } from "./components/GsapInteractionLayer";
import { ResponsiveTableCards } from "./components/ResponsiveTableCards";
import { SessionHeartbeat } from "./components/SessionHeartbeat";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { usePrintLightTheme } from "./hooks/usePrintLightTheme";

import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { router } from "./routes/router";
import { useAuthStore } from "./store/authStore";
import { trackPageView } from "./utils/traffic";

function App() {
  const initialized = useAuthStore((state) => state.initialized);

  useApplyTheme();
  usePrintLightTheme();

  useEffect(() => {
    // One page view per navigation. The data router exposes a subscription that
    // fires on every completed navigation, which is simpler and more reliable
    // than threading a useLocation component through every route tree.
    let lastPath = "";
    const report = (pathname: string) => {
      if (pathname && pathname !== lastPath) {
        lastPath = pathname;
        trackPageView(pathname);
      }
    };
    report(router.state.location.pathname);
    const unsubscribe = router.subscribe((state) => report(state.location.pathname));
    return unsubscribe;
  }, []);

  useEffect(() => {
    void initializeSession();

    const handlePlay = (e: Event) => {
      const audios = document.getElementsByTagName("audio");
      for (let i = 0; i < audios.length; i++) {
        if (audios[i] !== e.target) {
          audios[i].pause();
        }
      }
    };
    document.addEventListener("play", handlePlay, true);

    // Prevent mouse wheel scrolling from changing values in number/range inputs across all forms
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement &&
        (target.type === "number" || target.type === "range")
      ) {
        target.blur();
      } else if (
        document.activeElement instanceof HTMLInputElement &&
        (document.activeElement.type === "number" || document.activeElement.type === "range")
      ) {
        document.activeElement.blur();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true });

    // Auto-adjust height for all textareas according to content entered
    const autoResize = (el: HTMLTextAreaElement) => {
      if (el.dataset.noAutoResize === "true") return;
      const scrollPos = window.scrollY;
      const style = window.getComputedStyle(el);
      const minHeight = parseFloat(style.minHeight) || 0;
      el.style.height = "auto";
      const newHeight = Math.max(el.scrollHeight, minHeight);
      if (newHeight > 0) {
        el.style.height = `${newHeight}px`;
      }
      if (window.scrollY !== scrollPos) {
        window.scrollTo(window.scrollX, scrollPos);
      }
    };

    const handleTextareaInput = (e: Event) => {
      if (e.target instanceof HTMLTextAreaElement) {
        autoResize(e.target);
      }
    };

    const handleTextareaFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLTextAreaElement) {
        autoResize(e.target);
      }
    };

    document.addEventListener("input", handleTextareaInput, true);
    document.addEventListener("focusin", handleTextareaFocus, true);

    const resizeAll = () => {
      document.querySelectorAll("textarea").forEach((ta) => autoResize(ta));
    };

    const resizeTextareasIn = (node: Node) => {
      if (node instanceof HTMLTextAreaElement) {
        autoResize(node);
        return;
      }
      if (node instanceof HTMLElement) {
        node.querySelectorAll("textarea").forEach((ta) => autoResize(ta));
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          resizeTextareasIn(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    resizeAll();

    return () => {
      document.removeEventListener("play", handlePlay, true);
      window.removeEventListener("wheel", handleWheel);
      document.removeEventListener("input", handleTextareaInput, true);
      document.removeEventListener("focusin", handleTextareaFocus, true);
      observer.disconnect();
    };
  }, []);

  return (
    <>

      <GlobalLoader />
      <GlobalDialog />
      <GlobalSnackbar />
      <GlobalConfirmModal />
      <GsapInteractionLayer />
      <ResponsiveTableCards />
      <SessionHeartbeat />
      <ImpersonationBanner />
      <MaintenanceNotice />
      <ConnectivityNotice />
      {initialized && (
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                width: "100%",
                background: "var(--surface, #ffffff)",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  border: "3px solid var(--border, rgba(15, 23, 42, 0.1))",
                  borderTopColor: "var(--primary, #b91c2b)",
                  borderRadius: "50%",
                  animation: "appSpinner 0.7s linear infinite",
                }}
              />
              <style>{`
                @keyframes appSpinner {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      )}
    </>
  );
}

export default App;
