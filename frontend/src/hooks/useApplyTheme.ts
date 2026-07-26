import { useEffect } from "react";
import {
  getSystemTheme,
  THEME_CHANGE_EVENT,
  useThemeStore,
  type Theme,
} from "@/store/themeStore";

/**
 * Mirrors the theme store onto the document and keeps it in sync with the OS.
 *
 * Mount once, at the app root. `data-theme` is written to <html> (which the
 * `[data-theme="dark"] .some-class` overrides in index.css/tokens.css key off)
 * and to <body>, since parts of the app read the attribute from either.
 */
export function useApplyTheme() {
  const theme = useThemeStore((state) => state.theme);
  const syncSystemTheme = useThemeStore((state) => state.syncSystemTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    // The favicon is deliberately not touched here — the tab icon stays the same
    // in both themes. See the <link rel="icon"> comment in index.html.

    // Legacy/non-React listeners (and the iframed dc-pages bridge) key off this.
    window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = () => syncSystemTheme(getSystemTheme());
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [syncSystemTheme]);
}
