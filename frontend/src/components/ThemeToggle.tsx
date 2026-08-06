import { useThemeStore } from "@/store/themeStore";
import { themeToggleStrings as strings } from "./ThemeToggle.strings";
import "./ThemeToggle.css";

interface ThemeToggleProps {
  className?: string;
  /** Renders a text label beside the icon (for menus/settings rows). */
  withLabel?: boolean;
}

export function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";
  const actionLabel = isDark ? strings.switchToLight : strings.switchToDark;

  return (
    <button
      type="button"
      className={`theme-toggle${withLabel ? " has-label" : ""}${className ? ` ${className}` : ""}`}
      onClick={toggleTheme}
      title={actionLabel}
      aria-label={actionLabel}
      aria-pressed={isDark}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {/* Both icons stay mounted so they can cross-fade/rotate between states. */}
        <svg
          className="theme-toggle-sun"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <svg
          className="theme-toggle-moon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
      {withLabel && <span className="theme-toggle-label">{isDark ? strings.darkLabel : strings.lightLabel}</span>}
    </button>
  );
}
