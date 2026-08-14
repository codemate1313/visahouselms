import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { initializeSession } from "./api/client";
import { GlobalConfirmModal } from "./components/ConfirmModal";
import { GlobalDialog } from "./components/GlobalDialog";
import { GlobalLoader } from "./components/GlobalLoader";
import { GlobalSnackbar } from "./components/GlobalSnackbar";
import { GsapInteractionLayer } from "./components/GsapInteractionLayer";
import { ResponsiveTableCards } from "./components/ResponsiveTableCards";
import { SessionHeartbeat } from "./components/SessionHeartbeat";
import { useApplyTheme } from "./hooks/useApplyTheme";

import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { router } from "./routes/router";
import { useAuthStore } from "./store/authStore";
import { trackPageView } from "./utils/traffic";

function App() {
  const initialized = useAuthStore((state) => state.initialized);

  useApplyTheme();

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

    return () => {
      document.removeEventListener("play", handlePlay, true);
      window.removeEventListener("wheel", handleWheel);
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
      {initialized && (
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      )}
    </>
  );
}

export default App;
