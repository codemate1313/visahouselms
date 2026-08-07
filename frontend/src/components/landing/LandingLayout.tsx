import { useEffect } from "react";
import { Outlet, useLocation, ScrollRestoration } from "react-router-dom";
import { consumeLogoutRedirect } from "../../auth/logoutRedirect";

export function LandingLayout() {
  const location = useLocation();

  useEffect(() => {
    consumeLogoutRedirect();
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

