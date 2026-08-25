import { useRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { PUBLIC_FOOTER_COLUMNS, SOCIAL_ICON_NAMES, SOCIAL_LABELS } from "./navConfig";
import { useFooterParallax } from "./useFooterParallax";
import "@/styles/public/chrome.css";

export interface PublicSocialLink {
  id: number | string;
  platform: string;
  url: string;
}

export function PublicFooter({ socialLinks = [] }: { socialLinks?: PublicSocialLink[] }) {
  const footerRef = useRef<HTMLElement | null>(null);
  useFooterParallax(footerRef);

  const displaySocialLinks = socialLinks;

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="vh-footer" ref={footerRef}>
      <div className="vh-footer-grid">
        {/* Brand & Overview Column */}
        <div className="vh-footer-brand-col">
          <div className="vh-footer-brand-row">
            <img src="/brand/vh-mark-dark.png" alt="Visa House" width={40} height={40} />
            <div className="vh-footer-brand-info">
              <span className="vh-footer-brand-title">Visa House</span>
              <span className="vh-footer-brand-badge">Official LMS Ecosystem</span>
            </div>
          </div>

          <p className="vh-footer-tagline">
            Next-generation LanguageCert preparation, AI-powered mock tests, and smart LMS infrastructure for institutions & students worldwide.
          </p>

          <div className="vh-footer-interactive-row">
            <ul className="footer-social-icons">
              {displaySocialLinks.map((social) => (
                <li className="icon-content" key={social.id}>
                  <a
                    href={social.url}
                    data-social={social.platform}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={SOCIAL_LABELS[social.platform] || social.platform}
                  >
                    <div className="filled" />
                    <Icon name={SOCIAL_ICON_NAMES[social.platform] ?? "socialWebsite"} />
                  </a>
                  <div className="tooltip">{SOCIAL_LABELS[social.platform] || social.platform}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Navigation Columns */}
        {PUBLIC_FOOTER_COLUMNS.map((col) => (
          <div className="vh-footer-col" key={col.title}>
            <h4>
              <span className="vh-footer-col-accent" />
              {col.title}
            </h4>
            <div className="vh-footer-col-links">
              {col.links.map((link) => (
                <Link key={link.label} to={link.url} className="vh-footer-link">
                  <span className="vh-footer-link-text">{link.label}</span>
                </Link>
              ))}
            </div>
            {col.title === "Partnerships" && (
              <div className="vh-footer-back-to-top-wrap">
                <button
                  type="button"
                  className="vh-footer-back-to-top"
                  onClick={scrollToTop}
                  aria-label="Back to top"
                  title="Scroll to top"
                >
                  <svg
                    className="vh-footer-back-to-top-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="18 15 12 9 6 15" />
                    <polyline points="18 9 12 3 6 9" />
                  </svg>
                  <span>BACK TO TOP</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      {/* Privacy Policy / Terms of Service / Security links removed: no real
          pages exist for these yet anywhere in the app. A missing link here
          is more honest than a dead `href="#"` — restore this row once those
          pages exist and route them accordingly. */}
      <div className="vh-footer-bottom">
        <div className="vh-footer-bottom-copy">
          <span>© {new Date().getFullYear()} Visa House LanguageCert LMS. All rights reserved.</span>
        </div>
      </div>

      {/* Giant Shaded Brand Watermark */}
      <div className="vh-footer-watermark-wrap" aria-hidden="true">
        <span className="vh-footer-watermark-text">VISA HOUSE</span>
      </div>
    </footer>
  );
}
