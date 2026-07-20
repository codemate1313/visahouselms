import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  const passwordRoutes: Record<string, string> = {
    SUPER_ADMIN: "/super-admin/change-password",
    SA_INSTRUCTOR: "/instructor/change-password",
  };
  const requiredRoute = passwordRoutes[user.role];
  if (user.force_password_reset && requiredRoute && location.pathname !== requiredRoute) {
    return <Navigate to={requiredRoute} replace />;
  }

  return <Outlet />;
}
