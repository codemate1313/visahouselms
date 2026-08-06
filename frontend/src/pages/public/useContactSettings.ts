import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";

export interface PublicSocialLink {
  id: number;
  platform: string;
  url: string;
}

export interface PublicContactSettings {
  contact: {
    email: string;
    email_note: string | null;
    phone: string;
    phone_note: string | null;
    support_url: string;
    support_note: string | null;
    office_name: string;
    office_address: string;
  };
  social_links: PublicSocialLink[];
}

/** Shared by every public marketing page — the footer's social icons (and, on
 * /contact, the info cards) are all served from the same admin-editable
 * settings, so each page fetches the same `contactSettings` here rather than
 * duplicating the request. `social_links` is rendered by `PublicFooter` via
 * `components/icons.tsx`'s `<Icon name="social...">`. */
export function useContactSettings(): PublicContactSettings | null {
  const [contactSettings, setContactSettings] = useState<PublicContactSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PublicContactSettings>("/contact-settings", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setContactSettings(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return contactSettings;
}
