import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { initializeSession } from "./api/client";
import { GlobalConfirmModal } from "./components/ConfirmModal";
import { GlobalDialog } from "./components/GlobalDialog";
import { GlobalLoader } from "./components/GlobalLoader";
import { GlobalSnackbar } from "./components/GlobalSnackbar";
import { GsapInteractionLayer } from "./components/GsapInteractionLayer";
import { router } from "./routes/router";
import { useAuthStore } from "./store/authStore";

function App() {
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    void initializeSession();
  }, []);

  return (
    <>
      <GlobalLoader />
      <GlobalDialog />
      <GlobalSnackbar />
      <GlobalConfirmModal />
      <GsapInteractionLayer />
      {initialized && (
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      )}
    </>
  );
}

export default App;
