import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { destinationFor } from "@/pages/Login/helpers";
import { PUBLIC_NAV_ITEMS } from "./navConfig";
import { useMobileDrawer } from "./useMobileDrawer";
import "@/styles/public/chrome.css";

function ThemeIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function ArrowRightIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const user = useAuthStore((state) => state.user);
  const { open, toggle, close, drawerRef, scrimRef, line1Ref, line2Ref, line3Ref } = useMobileDrawer();
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);

  const dark = theme === "dark";
  const authHref = user ? destinationFor(user) ?? "/" : "/login";
  const authLabel = user ? "Go to dashboard" : "Sign in";

  const goAuth = () => {
    close();
    navigate(authHref);
  };

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    setHeaderVisible(true);
  }, [location.pathname]);

  useEffect(() => {
    const updateHeader = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const previousScrollY = lastScrollYRef.current;

      if (open || currentScrollY <= 12) {
        setHeaderVisible(true);
      } else if (currentScrollY > previousScrollY) {
        setHeaderVisible(false);
      } else if (currentScrollY < previousScrollY) {
        setHeaderVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
      scrollFrameRef.current = null;
    };

    const handleScroll = () => {
      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = window.requestAnimationFrame(updateHeader);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [open]);

  const hideHeaderAfterHover = () => {
    if (!open && window.scrollY > 12) {
      setHeaderVisible(false);
    }
  };

  return (
    <>
      <div
        className={`vh-header-reveal-zone${headerVisible ? "" : " vh-active"}`}
        onPointerEnter={() => setHeaderVisible(true)}
        aria-hidden="true"
      />
      <header
        className={`vh-header${headerVisible ? "" : " vh-header-hidden"}`}
        onPointerLeave={hideHeaderAfterHover}
        onFocusCapture={() => setHeaderVisible(true)}
      >
      <div className="vh-header-bar">
        <Link to="/" className="vh-brand">
          <img src={dark ? "/brand/vh-mark-dark.png" : "/brand/vh-mark-light.png"} alt="Visa House" width={38} height={38} />
          <span>Visa House</span>
        </Link>

        <nav className="vh-nav">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <Link key={item.href} to={item.href} className={`vh-nav-link${location.pathname === item.href ? " vh-active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="vh-header-actions">
          <button type="button" className="vh-theme-toggle" title={`Theme: ${dark ? "Dark" : "Light"}`} onClick={toggleTheme}>
            <ThemeIcon dark={dark} />
          </button>
          <button type="button" className="vh-desktop-auth" onClick={goAuth}>
            {authLabel}
            <ArrowRightIcon />
          </button>
          <button type="button" className="vh-mobile-toggle" onClick={toggle} aria-label="Toggle navigation" aria-controls="vh-mobile-nav" aria-expanded={open}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line ref={line1Ref} x1={3} y1={6} x2={21} y2={6} />
              <line ref={line2Ref} x1={3} y1={12} x2={21} y2={12} />
              <line ref={line3Ref} x1={3} y1={18} x2={21} y2={18} />
            </svg>
          </button>
        </div>
      </div>

      <div className="vh-mobile-scrim" ref={scrimRef} onClick={close} aria-hidden="true" />
      <div className="vh-mobile-drawer" id="vh-mobile-nav" ref={drawerRef}>
        <div className="vh-mobile-drawer-inner">
          <p className="vh-drawer-eyebrow vh-drawer-item">Navigate</p>
          <nav className="vh-drawer-nav" onClick={close}>
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link key={item.href} to={item.href} className={`vh-drawer-link vh-drawer-item${location.pathname === item.href ? " vh-active" : ""}`}>
                <span>{item.label}</span>
                <ChevronRightIcon />
              </Link>
            ))}
          </nav>
          <hr className="vh-drawer-divider vh-drawer-item" />
          <div className="vh-drawer-cta vh-drawer-item">
            <button type="button" className="vh-drawer-btn vh-drawer-btn-solid" onClick={goAuth}>
              {authLabel}
            </button>
          </div>
          <p className="vh-drawer-foot vh-drawer-item">LanguageCert mock tests, progress analytics &amp; expert feedback.</p>
        </div>
      </div>
      </header>
    </>
  );
}
