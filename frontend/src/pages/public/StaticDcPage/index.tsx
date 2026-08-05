import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useLoaderStore } from "@/store/loaderStore";
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
  const [showInstituteBanner, setShowInstituteBanner] = useState(false);
  const publicTheme = useThemeStore((state) => state.theme) as PublicTheme;
  const [pageHtml, setPageHtml] = useState(() => buildLoadingHtml(useThemeStore.getState().theme as PublicTheme, title));
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const user = useAuthStore((state) => state.user);
  const isLoading = useLoaderStore((state) => state.isLoading);

  // A signed-in visitor browsing the marketing site is not lost - they came
  // here on purpose. Rather than bounce them to their dashboard, the nav offers
  // it as a destination and leaves the choice with them.
  const authState = useMemo(
    () =>
      user
        ? { signedIn: true, label: "Go to dashboard", href: destinationFor(user) ?? "/" }
        : { signedIn: false, label: "Sign in", href: "/login" },
    [user],
  );
  const pageBackground = publicTheme === "dark" ? "#0a0a0f" : "#f7f5f2";

  useEffect(() => {
    const isAuthPath = location.pathname === "/login" || location.pathname === "/register";
    // Already signed in and asking to sign in: the overlay cannot be dismissed
    // by an authenticated user, so opening it would trap them. This is the only
    // place a signed-in visitor is redirected - browsing the rest of the site
    // leaves them exactly where they are.
    if (isAuthPath && user) {
      setAuthMode(null);
      navigate(authState.href, { replace: true });
      return;
    }
    if (location.pathname === "/login") {
      setAuthMode("login");
    } else if (location.pathname === "/register") {
      setAuthMode("register");
    } else {
      setAuthMode(null);
    }
  }, [authState.href, location.pathname, navigate, user]);

  const handleAuthClose = useCallback(() => {
    if (user) return;
    navigate("/", { replace: true });
  }, [navigate, user]);

  useEffect(() => {
    if (!authMode) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading && !user) handleAuthClose();
    }

    const releaseScroll = lockBodyScroll();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [authMode, handleAuthClose, isLoading, user]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const isTrustedPublicPage =
        event.origin === window.location.origin ||
        event.origin === "null" ||
        event.source === frameRef.current?.contentWindow;
      if (!isTrustedPublicPage) return;
      if (event.data?.type === "vh-auth") {
        if (!user) {
          // Unauthenticated: send them to the one login/register screen
          const mode = event.data.mode === "login" ? "login" : "register";
          navigate(mode === "login" ? "/login" : "/register", {
            state: { planId: event.data.planId ?? null },
          });
        } else if (event.data.mode === "dashboard") {
          // The nav button, which reads "Go to dashboard" once signed in.
          navigate(authState.href);
        } else if (user.role === "STUDENT" && user.institute_id != null) {
          // Institute student: show explanation banner — they cannot buy plans
          setShowInstituteBanner(true);
        } else if (user.role === "STUDENT") {
          // Direct student: go straight to the purchase catalog
          navigate("/student/courses");
        } else {
          // Everyone else already has somewhere to be.
          navigate(authState.href);
        }
      }
      if (event.data?.type === "vh-navigate" && event.data.href) {
        navigate(event.data.href);
      }
      if (event.data?.type === "vh-theme") {
        const theme = event.data.theme === "dark" ? "dark" : "light";
        // The app writes `data-theme` on <html>, and a great many rules key off
        // it - the segmented control, inputs, headings. Leaving it behind meant
        // the login overlay could be light while everything the app styled
        // inside it stayed dark: white text on a white card, a black role bar.
        // The store is the single source now, so the two cannot disagree.
        useThemeStore.getState().setTheme(theme);
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
              "*"
            );
          })
          .catch((error: Error) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: "vh-support-ticket-result", requestId, ok: false, error: error.message },
              "*"
            );
          });
      }
      if (event.data?.type === "vh-institute-signup") {
        const requestId = event.data.requestId;
        const payload = event.data.payload ?? {};

        fetch(`${API_BASE_URL}/institute-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institute_name: payload.institute_name,
            contact_email: payload.email,
            contact_phone: payload.phone || null,
            city: payload.city || null,
            country: payload.country || null,
            website: payload.website || null,
            admin_first_name: payload.admin_first_name,
            admin_last_name: payload.admin_last_name,
            admin_email: payload.admin_email,
            expected_students: payload.expected_students ? Number(payload.expected_students) : null,
            message: payload.message || null,
            interested_plan_id: payload.interested_plan_id || null,
          }),
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              // The server's own words are far more use than a generic failure:
              // "you already have an account" and "we already have your
              // application" are both things the applicant can act on. FastAPI
              // returns validation errors as a list, so those are flattened
              // rather than stringified into "[object Object]".
              const detail = Array.isArray(data.detail)
                ? data.detail.map((item: { msg?: string }) => item?.msg).filter(Boolean).join(". ")
                : data.detail;
              throw new Error(detail || "Unable to submit application.");
            }
            frameRef.current?.contentWindow?.postMessage(
              { type: "vh-institute-signup-result", requestId, ok: true },
              "*"
            );
          })
          .catch((error: Error) => {
            frameRef.current?.contentWindow?.postMessage(
              {
                type: "vh-institute-signup-result",
                requestId,
                ok: false,
                error: error.message || "Unable to submit application.",
              },
              "*"
            );
          });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [authState, navigate, user]);

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
        if (!cancelled) setPageHtml(buildPublicPageHtml(html, fileName, { ...(bootstrap as object ?? {}), auth: authState }));
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
  }, [authState, bootstrap, bootstrapPending, fileName, publicTheme, src, title]);

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
          onClose={handleAuthClose}
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
