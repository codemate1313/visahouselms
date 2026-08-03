import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useStudentAccess } from "@/hooks/useStudentAccess";

/**
 * Sections a student only gets once they hold a paid plan. Without one the
 * portal is demo-only, so these routes are hidden from the sidebar — this stops
 * them being reached by typing the URL as well.
 *
 * Purely a navigation guard: the API enforces entitlement independently.
 */
export function RequireActivePlan({ children }: { children: ReactElement }): ReactElement | null {
  const { loading, hasActivePlan } = useStudentAccess();
  if (loading) return null;
  if (!hasActivePlan) return <Navigate replace to="/student/my-courses" />;
  return children;
}
