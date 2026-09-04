import { useEffect, useState } from "react";

interface RouteLoadingStateProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | number;
}

export function RouteLoadingState({ label, className = "", size = "md" }: RouteLoadingStateProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme") || document.body.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  const scale = typeof size === "number"
    ? Math.max(0.3, Math.min(2, size / 60))
    : size === "sm" ? 0.6 : size === "lg" ? 1 : 0.8;

  return (
    <div
      className={`route-loading-state ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading..."}
    >
      <div className="simple-loader-frame" style={{ transform: `scale(${scale})`, margin: "0 auto" }}>
        <div className="simple-spinner-ring" />
        <img
          src={isDark ? "/brand/vh-mark-dark-96.png" : "/brand/vh-mark-96.png"}
          alt="Visa House Logo"
          className="simple-loader-logo"
          onError={(e) => {
            const target = e.currentTarget;
            const fallback = isDark ? "/brand/vh-mark-dark.png" : "/brand/vh-mark.png";
            if (target.src !== window.location.origin + fallback) {
              target.src = fallback;
            }
          }}
        />
      </div>
      {label && (
        <span style={{ marginTop: "12px", fontSize: "0.875rem", color: "var(--ink2, #64748b)", fontWeight: 500 }}>
          {label}
        </span>
      )}
    </div>
  );
}
