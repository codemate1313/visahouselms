import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";

export type PublicAuthMode = "register" | "login" | "dashboard";

/**
 * Shared "sign up / sign in" action for the marketing site's purchase-intent
 * buttons (hero CTA, plan cards). Ported from `StaticDcPage`'s `vh-auth`
 * postMessage handler: an institute-linked student can't buy plans directly
 * (their institute manages that), so registering is swapped for an
 * explanatory banner instead of bouncing them into a purchase flow that
 * would just reject them.
 */
export function usePublicAuthAction() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [showInstituteBanner, setShowInstituteBanner] = useState(false);

  const handleAuth = useCallback(
    (mode: PublicAuthMode, planId?: number | string | null) => {
      if (!user) {
        navigate(mode === "login" ? "/login" : "/register", { state: { planId: planId ?? null } });
        return;
      }
      if (mode === "dashboard") {
        navigate(destinationFor(user) ?? "/");
        return;
      }
      if (user.role === "STUDENT" && user.institute_id != null) {
        setShowInstituteBanner(true);
        return;
      }
      if (user.role === "STUDENT") {
        navigate("/student/courses");
        return;
      }
      navigate(destinationFor(user) ?? "/");
    },
    [user, navigate],
  );

  const closeInstituteBanner = useCallback(() => setShowInstituteBanner(false), []);
  const goToMyCourses = useCallback(() => {
    setShowInstituteBanner(false);
    navigate("/student/my-courses");
  }, [navigate]);

  return { handleAuth, showInstituteBanner, closeInstituteBanner, goToMyCourses };
}
