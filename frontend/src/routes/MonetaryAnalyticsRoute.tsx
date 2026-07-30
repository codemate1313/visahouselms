import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function MonetaryAnalyticsRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!(user?.is_owner || user?.can_view_monetary_analytics)) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }
  return <>{children}</>;
}
