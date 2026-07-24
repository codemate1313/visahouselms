import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { consumeLogoutRedirect } from "../../auth/logoutRedirect";

export function LandingLayout() {
  const location = useLocation();

  useEffect(() => {
    consumeLogoutRedirect();
  }, [location.pathname]);

  return <Outlet />;
}
