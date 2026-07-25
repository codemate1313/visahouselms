import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthOverlay } from "./components/AuthOverlay";
import type { AuthMode, PublicTheme } from "./types";

interface StaticDcPageProps {
  fileName: string;
  title: string;
}

function getInitialPublicTheme(): PublicTheme {
  try {
    const saved = window.localStorage.getItem("vh-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Ignore storage access issues and fall back to the system theme.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function StaticDcPage({ fileName, title }: StaticDcPageProps) {
  const src = useMemo(() => `/dc-pages/${fileName}`, [fileName]);
  const location = useLocation();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [publicTheme, setPublicTheme] = useState<PublicTheme>(() => getInitialPublicTheme());
  const pageBackground = publicTheme === "dark" ? "#0a0a0f" : "#f7f5f2";

  useEffect(() => {
    if (location.pathname === "/login") {
      setAuthMode("login");
    } else if (location.pathname === "/register") {
      setAuthMode("register");
    } else {
      setAuthMode(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "vh-auth") {
        const mode = event.data.mode === "login" ? "login" : "register";
        navigate(mode === "login" ? "/login" : "/register");
      }
      if (event.data?.type === "vh-theme") {
        const theme = event.data.theme === "dark" ? "dark" : "light";
        setPublicTheme(theme);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  useEffect(() => {
    function handleSystemThemeChange() {
      try {
        if (window.localStorage.getItem("vh-theme")) return;
      } catch {
        // Continue with system theme fallback.
      }
      setPublicTheme(getInitialPublicTheme());
    }

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", handleSystemThemeChange);
    return () => media?.removeEventListener?.("change", handleSystemThemeChange);
  }, []);

  function handleClose() {
    navigate("/", { replace: true });
  }

  useEffect(() => {
    if (!authMode) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authMode]);

  return (
    <div style={{ minHeight: "100vh", background: pageBackground }}>
      <iframe
        title={title}
        src={src}
        style={{
          display: "block",
          width: "100%",
          minHeight: "100vh",
          height: "100vh",
          border: 0,
          background: pageBackground,
        }}
      />

      {authMode && (
        <AuthOverlay
          authMode={authMode}
          publicTheme={publicTheme}
          onClose={() => setAuthMode(null)}
          onModeChange={setAuthMode}
        />
      )}
    </div>
  );
}
