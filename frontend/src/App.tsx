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

import { router } from "./routes/router";
import { useAuthStore } from "./store/authStore";

function App() {
  const initialized = useAuthStore((state) => state.initialized);

  useApplyTheme();

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

    return () => {
      document.removeEventListener("play", handlePlay, true);
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
      {initialized && (
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      )}
    </>
  );
}

export default App;
