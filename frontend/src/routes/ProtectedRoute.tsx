import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

function loginPathForRole(role?: string) {
  if (role === "SUPER_ADMIN") return "/super-admin/login";
  if (role === "SA_INSTRUCTOR") return "/sa-instructor/login";
  return "/login";
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!accessToken || !user) {
    return <Navigate to={loginPathForRole(allowedRoles?.[0])} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={loginPathForRole(user.role)} replace />;
  }

  const passwordRoutes: Record<string, string> = {
    SUPER_ADMIN: "/super-admin/change-password",
    SA_INSTRUCTOR: "/super-admin/instructor/change-password",
    INSTITUTE_ADMIN: "/institute-portal/change-password",
    STUDENT: "/student/change-password",
  };
  const requiredRoute = passwordRoutes[user.role];
  if (user.force_password_reset && requiredRoute && location.pathname !== requiredRoute) {
    return <Navigate to={requiredRoute} replace />;
  }

  return <Outlet />;
}
