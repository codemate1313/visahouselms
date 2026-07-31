import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLoaderStore } from "@/store/loaderStore";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";
import { API_BASE_URL } from "@/api/client";
import { AuthOverlay } from "./components/AuthOverlay";
import { InstitutePlanBanner } from "./components/InstitutePlanBanner";
import type { AuthMode, PublicTheme } from "./types";

interface StaticDcPageProps {
  fileName: string;
  title: string;
  /** Server data handed to the framed page as `window.__vhData`. */
  bootstrap?: unknown;
  /** Holds the loading screen until `bootstrap` has been fetched. */
  bootstrapPending?: boolean;
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

function buildPublicPageHtml(html: string, fileName: string, bootstrap: unknown) {
  const baseHref = `${window.location.origin}/dc-pages/${fileName}`;
  const parentOrigin = JSON.stringify(window.location.origin);
  // `</script>` inside the payload would otherwise close the injected tag early.
  const data = JSON.stringify(bootstrap ?? null).replace(/</g, "\\u003c");
  const injectedHead = `<base href="${baseHref}"><script>window.__vhParentOrigin=${parentOrigin};window.__vhData=${data};</script>`;

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

export function StaticDcPage({ fileName, title, bootstrap, bootstrapPending = false }: StaticDcPageProps) {
  const src = useMemo(() => `/dc-pages/${fileName}`, [fileName]);
  const location = useLocation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [showInstituteBanner, setShowInstituteBanner] = useState(false);
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
        event.origin === window.location.origin ||
        event.origin === "null" ||
        event.source === frameRef.current?.contentWindow;
      if (!isTrustedPublicPage) return;
      if (event.data?.type === "vh-auth") {
        if (!user) {
          // Unauthenticated: open register or login overlay
          const mode = event.data.mode === "login" ? "login" : "register";
          navigate(mode === "login" ? "/login" : "/register", {
            state: { planId: event.data.planId ?? null },
          });
        } else if (user.role === "STUDENT" && user.institute_id != null) {
          // Institute student: show explanation banner — they cannot buy plans
          setShowInstituteBanner(true);
        } else if (user.role === "STUDENT") {
          // Direct student: go straight to the purchase catalog
          navigate("/student/courses");
        }
      }
      if (event.data?.type === "vh-navigate" && event.data.href) {
        navigate(event.data.href);
      }
      if (event.data?.type === "vh-theme") {
        const theme = event.data.theme === "dark" ? "dark" : "light";
        setPublicTheme(theme);
      }
      if (event.data?.type === "vh-support-ticket") {
        const requestId = event.data.requestId;
        fetch(`${API_BASE_URL}/support/tickets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.data.payload ?? {}),
        })
          .then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload.detail || "Unable to submit enquiry.");
            }
            frameRef.current?.contentWindow?.postMessage(
              { type: "vh-support-ticket-result", requestId, ok: true, payload },
              window.location.origin
            );
          })
          .catch((error: Error) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: "vh-support-ticket-result", requestId, ok: false, error: error.message },
              window.location.origin
            );
          });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setPageHtml(buildLoadingHtml(publicTheme, title));
    // Rendering now would boot the framed page against empty data, and the
    // late arrival would reload the iframe - wait for the payload instead.
    if (bootstrapPending) return undefined;

    fetch(src, { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${src}`);
        return response.text();
      })
      .then((html) => {
        if (!cancelled) setPageHtml(buildPublicPageHtml(html, fileName, bootstrap));
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
  }, [bootstrap, bootstrapPending, fileName, publicTheme, src, title]);

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

  const handleClose = useCallback(() => {
    if (user) return;
    navigate("/", { replace: true });
  }, [navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("noredirect") === "1") return;
    if (!user || (!authMode && location.pathname !== "/")) return;
    const destination = destinationFor(user);
    if (destination) navigate(destination, { replace: true });
  }, [authMode, location.pathname, location.search, navigate, user]);

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
  }, [authMode, handleClose, isLoading, user]);

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

      {showInstituteBanner && (
        <InstitutePlanBanner
          publicTheme={publicTheme}
          onClose={() => setShowInstituteBanner(false)}
          onGoToCourses={() => {
            setShowInstituteBanner(false);
            navigate("/student/my-courses");
          }}
        />
      )}
    </div>
  );
}
