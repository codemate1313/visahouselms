import { create } from "zustand";

export type Theme = "light" | "dark";

/**
 * Shared with the public marketing pages in `public/dc-pages/*.dc.html`, which
 * read and write this same key so the app and the iframed showcase pages agree
 * on a theme. Do not rename it without updating those files.
 */
export const THEME_STORAGE_KEY = "vh-theme";

/** Fired after every applied theme change, for non-React listeners. */
export const THEME_CHANGE_EVENT = "vh-theme-change";

interface ThemeState {
  theme: Theme;
  /** True while the theme is following the OS rather than a manual choice. */
  followsSystem: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Drop the manual override and follow the system preference again. */
  useSystemTheme: () => void;
  /** Internal: react to an OS change while no manual preference is stored. */
  syncSystemTheme: (theme: Theme) => void;
}

function readStoredTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    // Private mode / blocked storage — fall back to the system preference.
    return null;
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
}

const storedTheme = readStoredTheme();

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: storedTheme ?? getSystemTheme(),
  followsSystem: storedTheme === null,

  setTheme: (theme) => {
    if (get().theme === theme && !get().followsSystem) return;
    persistTheme(theme);
    set({ theme, followsSystem: false });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    persistTheme(next);
    set({ theme: next, followsSystem: false });
  },

  useSystemTheme: () => {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Ignore storage access issues.
    }
    set({ theme: getSystemTheme(), followsSystem: true });
  },

  // Only honoured while the user has not made a manual choice.
  syncSystemTheme: (theme) => {
    if (!get().followsSystem) return;
    set({ theme });
  },
}));
