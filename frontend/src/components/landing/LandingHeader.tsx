import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface LandingHeaderProps {
  onOpenLogin: () => void;
}

export function LandingHeader({ onOpenLogin }: LandingHeaderProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Home", path: "/" },
    { label: "About Us", path: "/about" },
    { label: "Plans & Pricing", path: "/plans" },
    { label: "Contact Us", path: "/contact" },
  ];

  return (
    <header className="landing-header">
      <div className="landing-header-container">
        {/* Brand Logo */}
        <Link to="/" className="landing-brand-logo">
          <div className="brand-icon-box">
            <span className="brand-dot" />
            <span className="brand-icon-text">IELTS</span>
          </div>
          <span className="brand-title">LMS <span className="brand-title-accent">PRO</span></span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="landing-nav-menu">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`landing-nav-link ${isActive ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="landing-header-actions">
          <button
            type="button"
            className="landing-login-btn"
            onClick={onOpenLogin}
          >
            <span>Sign In</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="landing-mobile-menu">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="mobile-login-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenLogin();
            }}
          >
            Sign In to Portal
          </button>
        </div>
      )}
    </header>
  );
}
