import { create } from "zustand";

export interface TypographyConfig {
  fontFamily: string;
  headingWeight: string;
  statWeight: string;
  bodyWeight: string;
}

export const FONT_FAMILY_OPTIONS = [
  { label: "Plus Jakarta Sans (Sleek SaaS)", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Sora (Tech-forward)", value: "'Sora', sans-serif" },
  { label: "Inter (Clean Enterprise)", value: "'Inter', sans-serif" },
  { label: "Outfit (Futuristic)", value: "'Outfit', sans-serif" },
];

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headingWeight: "600",
  statWeight: "600",
  bodyWeight: "400",
};

function applyCssVars(config: TypographyConfig) {
  const root = document.documentElement;
  root.style.setProperty("--app-font-family", config.fontFamily);
  root.style.setProperty("--app-heading-weight", config.headingWeight);
  root.style.setProperty("--app-stat-weight", config.statWeight);
  root.style.setProperty("--app-body-weight", config.bodyWeight);
}

// Load saved config or default
function getSavedConfig(): TypographyConfig {
  try {
    const saved = localStorage.getItem("ielts_lms_typography");
    return saved ? JSON.parse(saved) : DEFAULT_TYPOGRAPHY;
  } catch {
    return DEFAULT_TYPOGRAPHY;
  }
}

const initialConfig = getSavedConfig();
applyCssVars(initialConfig);

interface FontStore {
  config: TypographyConfig;
  updateConfig: (newConfig: Partial<TypographyConfig>) => void;
  resetConfig: () => void;
}

export const useFontStore = create<FontStore>((set, get) => ({
  config: initialConfig,
  updateConfig: (newConfig) => {
    const updated = { ...get().config, ...newConfig };
    localStorage.setItem("ielts_lms_typography", JSON.stringify(updated));
    applyCssVars(updated);
    set({ config: updated });
  },
  resetConfig: () => {
    localStorage.setItem("ielts_lms_typography", JSON.stringify(DEFAULT_TYPOGRAPHY));
    applyCssVars(DEFAULT_TYPOGRAPHY);
    set({ config: DEFAULT_TYPOGRAPHY });
  },
}));
