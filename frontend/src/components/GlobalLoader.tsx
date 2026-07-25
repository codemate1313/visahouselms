import { useEffect, useState } from "react";
import { useLoaderStore } from "../store/loaderStore";

export function GlobalLoader() {
  const isLoading = useLoaderStore((state) => state.isLoading);
  const message = useLoaderStore((state) => state.message);
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

  if (!isLoading) return null;

  return (
    <div
      className={`global-3d-loader-backdrop ${isDark ? "is-dark" : "is-light"}`}
      aria-label={message}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div className="simple-loader-content">
        <div className="vh-global-loader-box" aria-hidden="true">
          <div className="vh-loader-orbital-ring" />
          <div className="vh-loader-badge">
            <img
              src={isDark ? "/brand/vh-mark-dark.png" : "/brand/vh-mark-light.png"}
              alt="Visa House Logo"
              className="vh-loader-logo-img"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== window.location.origin + "/brand/vh-mark.png") {
                  target.src = "/brand/vh-mark.png";
                  return;
                }
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <span className="vh-loader-logo-text" style={{ display: "none" }}>VH</span>
          </div>
        </div>
        <p key={message} className="simple-loader-message">{message}</p>
      </div>
    </div>
  );
}
