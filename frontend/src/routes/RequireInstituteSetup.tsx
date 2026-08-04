import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useInstituteSetup } from "@/hooks/useInstituteSetup";

const SETUP_PATH = "/institute-portal/setup";
// Reachable while unpaid: an admin still has to be able to set the password
// they were emailed, read a notice, sign out, or ask for help.
const ALWAYS_ALLOWED = [SETUP_PATH, "/institute-portal/change-password", "/institute-portal/profile", "/institute-portal/support"];

/**
 * Holds a brand-new institute in the setup wizard until it has paid for a term.
 *
 * Purely navigational. The API refuses to add students or staff without an
 * active subscription regardless, so this exists to replace a trail of 402s
 * with a single screen that says what is actually needed.
 */
export function RequireInstituteSetup({ children }: { children: ReactElement }): ReactElement | null {
  const { loading, needsSetup } = useInstituteSetup();
  const { pathname } = useLocation();

  if (loading) return null;
  if (needsSetup && !ALWAYS_ALLOWED.some((path) => pathname.startsWith(path))) {
    return <Navigate replace to={SETUP_PATH} />;
  }
  // Equally, an institute that is already paid up has no business on the wizard.
  if (!needsSetup && pathname.startsWith(SETUP_PATH)) {
    return <Navigate replace to="/institute-portal/dashboard" />;
  }
  return children;
}
