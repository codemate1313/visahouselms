import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Login } from "../Login";
import { Register } from "../Register";

interface StaticDcPageProps {
  fileName: string;
  title: string;
}

type AuthMode = "login" | "register";
type PublicTheme = "light" | "dark";

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

  function handleModalClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a");
    const href = link?.getAttribute("href");
    if (href === "/login") {
      event.preventDefault();
      navigate("/login");
    }
    if (href === "/register") {
      event.preventDefault();
      navigate("/register");
    }
  }

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
        <div
          className={`login-modal-overlay static-auth-modal static-auth-modal-${publicTheme}`}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="login-modal-wrapper static-auth-modal-wrapper"
            onClick={(event) => {
              event.stopPropagation();
              handleModalClick(event);
            }}
          >
            <button
              type="button"
              className="login-modal-close-btn"
              onClick={handleClose}
              aria-label="Close dialog"
              title="Close"
            >
              x
            </button>
            {authMode === "login" ? <Login disableAnimation={true} /> : <Register />}
          </div>
        </div>
      )}
    </div>
  );
}
