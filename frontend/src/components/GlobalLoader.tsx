import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  return createPortal(
    <div
      className={`global-3d-loader-backdrop minimal-mode ${isDark ? "is-dark" : "is-light"}`}
      aria-label={message || "Loading..."}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div className="simple-loader-frame">
        <div className="simple-spinner-ring" />
        <img
          src="/brand/vh-mark-96.png"
          alt="Visa House Logo"
          className="simple-loader-logo"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== window.location.origin + "/brand/vh-mark.png") {
              target.src = "/brand/vh-mark.png";
            }
          }}
        />
      </div>
    </div>,
    document.body
  );
}
