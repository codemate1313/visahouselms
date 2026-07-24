import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { Login } from "../Login";
import { Register } from "../Register";

interface StaticDcPageProps {
  fileName: string;
  title: string;
}

type AuthMode = "login" | "register";

export function StaticDcPage({ fileName, title }: StaticDcPageProps) {
  const src = useMemo(() => `/dc-pages/${fileName}`, [fileName]);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "vh-auth") return;
      const mode = event.data.mode === "login" ? "login" : "register";
      setAuthMode(mode);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!authMode) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAuthMode(null);
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
      setAuthMode("login");
    }
    if (href === "/register") {
      event.preventDefault();
      setAuthMode("register");
    }
  }

  return (
    <>
      <iframe
        title={title}
        src={src}
        style={{
          display: "block",
          width: "100%",
          minHeight: "100vh",
          height: "100vh",
          border: 0,
          background: "#fff",
        }}
      />

      {authMode && (
        <div className="login-modal-overlay static-auth-modal" onClick={() => setAuthMode(null)} role="dialog" aria-modal="true">
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
              onClick={() => setAuthMode(null)}
              aria-label="Close dialog"
              title="Close"
            >
              x
            </button>
            {authMode === "login" ? <Login disableAnimation={true} /> : <Register />}
          </div>
        </div>
      )}
    </>
  );
}
