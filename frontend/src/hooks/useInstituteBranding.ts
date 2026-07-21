import { useEffect, useState } from "react";
import { API_BASE_URL, apiClient } from "../api/client";

export interface InstituteBrandingTheme {
  institute_id: number;
  institute_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  heading_font_weight: number;
  body_font_weight: number;
}

function fontStack(fontFamily: string) {
  if (fontFamily === "system-ui") return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  return `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
}

function readableForeground(hexColor: string) {
  const hex = hexColor.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.42 ? "#111113" : "#ffffff";
}

export function useInstituteBranding(slug: string | null | undefined) {
  const [branding, setBranding] = useState<InstituteBrandingTheme | null>(null);

  useEffect(() => {
    if (!slug) {
      setBranding(null);
      return;
    }

    let active = true;
    apiClient.get<InstituteBrandingTheme>(`/institutes/${slug}/branding`, {
      headers: { "X-Skip-Loader": "1" },
    }).then(({ data }) => {
      if (!active) return;
      setBranding(data);
      const root = document.documentElement;
      root.style.setProperty("--institute-primary", data.primary_color);
      root.style.setProperty("--institute-secondary", data.secondary_color);
      root.style.setProperty("--institute-on-primary", readableForeground(data.primary_color));
      root.style.setProperty("--institute-on-secondary", readableForeground(data.secondary_color));
      root.style.setProperty("--app-font-family", fontStack(data.font_family));
      root.style.setProperty("--app-heading-weight", String(data.heading_font_weight));
      root.style.setProperty("--app-body-weight", String(data.body_font_weight));
    }).catch(() => {
      if (active) setBranding(null);
    });

    return () => {
      active = false;
      const root = document.documentElement;
      root.style.removeProperty("--institute-primary");
      root.style.removeProperty("--institute-secondary");
      root.style.removeProperty("--institute-on-primary");
      root.style.removeProperty("--institute-on-secondary");
      root.style.removeProperty("--app-font-family");
      root.style.removeProperty("--app-heading-weight");
      root.style.removeProperty("--app-body-weight");
    };
  }, [slug]);

  return {
    branding,
    logoUrl: branding?.logo_url ? `${API_BASE_URL}${branding.logo_url}` : null,
  };
}
