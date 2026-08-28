import { create } from "zustand";

export interface TypographyConfig {
  fontFamily: string;
  headingWeight: string;
  statWeight: string;
  bodyWeight: string;
}

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headingWeight: "700",
  statWeight: "750",
  bodyWeight: "400",
};

function applyCssVars(config: TypographyConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--app-font-family", config.fontFamily);
  root.style.setProperty("--app-heading-weight", config.headingWeight);
  root.style.setProperty("--app-stat-weight", config.statWeight);
  root.style.setProperty("--app-body-weight", config.bodyWeight);
}

// Clear any stale local typography overrides
try {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("language_cert_typography");
  }
} catch {
  // Ignore storage errors
}

applyCssVars(DEFAULT_TYPOGRAPHY);

interface FontStore {
  config: TypographyConfig;
}

export const useFontStore = create<FontStore>(() => ({
  config: DEFAULT_TYPOGRAPHY,
}));
