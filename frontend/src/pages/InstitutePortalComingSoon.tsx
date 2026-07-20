import { useEffect, useState } from "react";
import { API_BASE_URL, apiClient } from "../api/client";
import { useAuthStore } from "../store/authStore";

interface Branding {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export function InstitutePortalComingSoon() {
  const user = useAuthStore((state) => state.user);
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    if (!user?.institute_slug) return;
    apiClient.get(`/institutes/${user.institute_slug}/branding`).then(({ data }) => {
      setBranding(data);
    });
  }, [user?.institute_slug]);

  useEffect(() => {
    if (!branding) return;
    document.documentElement.style.setProperty("--institute-primary", branding.primary_color);
    document.documentElement.style.setProperty("--institute-secondary", branding.secondary_color);
    return () => {
      document.documentElement.style.removeProperty("--institute-primary");
      document.documentElement.style.removeProperty("--institute-secondary");
    };
  }, [branding]);

  const logoSrc = branding?.logo_url ? `${API_BASE_URL}${branding.logo_url}` : null;

  return (
    <div className="institute-coming-soon">
      <div className="institute-coming-soon-card">
        {logoSrc ? (
          <img src={logoSrc} alt="" className="institute-coming-soon-logo" />
        ) : (
          <div className="institute-coming-soon-logo-placeholder" />
        )}
        <h1>Welcome, {user?.first_name}</h1>
        <p>
          Your institute portal is coming soon. This page is already themed with
          your institute's own branding colors.
        </p>
      </div>
    </div>
  );
}
