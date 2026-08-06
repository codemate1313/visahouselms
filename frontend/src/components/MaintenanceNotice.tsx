import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import "./MaintenanceNotice.css";

interface PlatformStatus {
  maintenance: boolean;
  message?: string | null;
}

/**
 * Full-screen notice shown while the site is closed for maintenance.
 *
 * Polls the public status endpoint, which stays reachable through the gate. The
 * developer role is never shown this - they are exactly who can still use the
 * site to reopen it - so the panel remains operable behind the notice everyone
 * else sees.
 *
 * The status endpoint is public and cheap, and the poll is slow (30s), so this
 * costs nothing in normal operation when maintenance is off.
 */
export function MaintenanceNotice() {
  const role = useAuthStore((state) => state.user?.role);
  const [status, setStatus] = useState<PlatformStatus>({ maintenance: false });

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const { data } = await apiClient.get<PlatformStatus>("/platform/status");
        if (alive) setStatus(data);
      } catch {
        // A failed status check is not itself a maintenance state; leave the app usable.
        if (alive) setStatus({ maintenance: false });
      }
    }
    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  // The people who close the site must be able to see it to reopen it.
  if (!status.maintenance || role === "DEVELOPER") return null;

  return (
    <div className="maintenance-notice" role="alertdialog" aria-label="Site maintenance">
      <div className="maintenance-notice-card">
        <div className="maintenance-notice-mark" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.4 1.4 0 0 0 2 2l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" />
          </svg>
        </div>
        <h1>We&rsquo;ll be right back</h1>
        <p>{status.message || "The platform is temporarily unavailable for scheduled maintenance. Please check back shortly."}</p>
      </div>
    </div>
  );
}
