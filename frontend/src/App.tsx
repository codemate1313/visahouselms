import { RouterProvider } from "react-router-dom";
import { GlobalDialog } from "./components/GlobalDialog";
import { GlobalLoader } from "./components/GlobalLoader";
import { GlobalSnackbar } from "./components/GlobalSnackbar";
import { router } from "./routes/router";

function App() {
  return (
    <>
      <GlobalLoader />
      <GlobalDialog />
      <GlobalSnackbar />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
