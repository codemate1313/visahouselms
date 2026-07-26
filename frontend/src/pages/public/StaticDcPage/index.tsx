import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLoaderStore } from "@/store/loaderStore";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";
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

function buildPublicPageHtml(html: string, fileName: string) {
  const baseHref = `${window.location.origin}/dc-pages/${fileName}`;
  const parentOrigin = JSON.stringify(window.location.origin);
  const injectedHead = `<base href="${baseHref}"><script>window.__vhParentOrigin=${parentOrigin};</script>`;

  if (html.includes("<head>")) return html.replace("<head>", `<head>${injectedHead}`);
  return `${injectedHead}${html}`;
}

function buildLoadingHtml(publicTheme: PublicTheme, title: string) {
  const dark = publicTheme === "dark";
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:${dark ? "#0a0a0f" : "#f7f5f2"};color:${dark ? "#f5f5f7" : "#111113"};font-family:Inter,system-ui,sans-serif;">
    <span style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65;">Loading ${title}</span>
  </body>
</html>`;
}

export function StaticDcPage({ fileName, title }: StaticDcPageProps) {
  const src = useMemo(() => `/dc-pages/${fileName}`, [fileName]);
  const location = useLocation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [publicTheme, setPublicTheme] = useState<PublicTheme>(() => getInitialPublicTheme());
  const [pageHtml, setPageHtml] = useState(() => buildLoadingHtml(getInitialPublicTheme(), title));
  const user = useAuthStore((state) => state.user);
  const isLoading = useLoaderStore((state) => state.isLoading);
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
      const isTrustedPublicPage =
        event.origin === window.location.origin || event.source === frameRef.current?.contentWindow;
      if (!isTrustedPublicPage) return;
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
    let cancelled = false;
    setPageHtml(buildLoadingHtml(publicTheme, title));

    fetch(src, { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${src}`);
        return response.text();
      })
      .then((html) => {
        if (!cancelled) setPageHtml(buildPublicPageHtml(html, fileName));
      })
      .catch(() => {
        if (cancelled) return;
        const dark = publicTheme === "dark";
        setPageHtml(`<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:${dark ? "#0a0a0f" : "#f7f5f2"};color:${dark ? "#f5f5f7" : "#111113"};font-family:Inter,system-ui,sans-serif;">
    <div style="text-align:center;">
      <strong style="display:block;font-size:18px;margin-bottom:8px;">Unable to load ${title}</strong>
      <span style="font-size:14px;opacity:.7;">Refresh the page or return home.</span>
    </div>
  </body>
</html>`);
      });

    return () => {
      cancelled = true;
    };
  }, [fileName, publicTheme, src, title]);

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
    if (user) return;
    navigate("/", { replace: true });
  }

  useEffect(() => {
    if (!user || (!authMode && location.pathname !== "/")) return;
    const destination = destinationFor(user);
    if (destination) navigate(destination, { replace: true });
  }, [authMode, location.pathname, navigate, user]);

  useEffect(() => {
    if (!authMode) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading && !user) handleClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authMode, isLoading, navigate, user]);

  return (
    <div style={{ minHeight: "100vh", background: pageBackground }}>
      <iframe
        ref={frameRef}
        key={fileName}
        title={title}
        srcDoc={pageHtml}
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
          onClose={handleClose}
          onModeChange={setAuthMode}
          closeDisabled={Boolean(user) || isLoading}
        />
      )}
    </div>
  );
}
