import { useEffect } from "react";
import { validateCurrentSession } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const SESSION_HEARTBEAT_MS = 15000;

export function SessionHeartbeat() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return undefined;

    let cancelled = false;

    const validate = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void validateCurrentSession().catch(() => undefined);
    };

    const intervalId = window.setInterval(validate, SESSION_HEARTBEAT_MS);
    window.addEventListener("focus", validate);
    document.addEventListener("visibilitychange", validate);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", validate);
      document.removeEventListener("visibilitychange", validate);
    };
  }, [accessToken]);

  return null;
}
