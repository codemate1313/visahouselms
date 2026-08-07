import { useRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { useThemeStore } from "@/store/themeStore";
import { PUBLIC_FOOTER_COLUMNS, SOCIAL_ICON_NAMES, SOCIAL_LABELS } from "./navConfig";
import { useFooterParallax } from "./useFooterParallax";
import "@/styles/public/chrome.css";

export interface PublicSocialLink {
  id: number | string;
  platform: string;
  url: string;
}

export function PublicFooter({ socialLinks = [] }: { socialLinks?: PublicSocialLink[] }) {
  const dark = useThemeStore((state) => state.theme === "dark");
  const footerRef = useRef<HTMLElement | null>(null);
  useFooterParallax(footerRef);

  return (
    <footer className="vh-footer" ref={footerRef}>
      <div className="vh-footer-grid">
        <div>
          <div className="vh-footer-brand-row">
            <img src={dark ? "/brand/vh-mark-dark.png" : "/brand/vh-mark-light.png"} alt="Visa House" width={34} height={34} />
            <span>Visa House LMS</span>
          </div>
          <ul className="footer-social-icons">
            {socialLinks.map((social) => (
              <li className="icon-content" key={social.id}>
                <a href={social.url} data-social={social.platform} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[social.platform] || social.platform}>
                  <div className="filled" />
                  <Icon name={SOCIAL_ICON_NAMES[social.platform] ?? "socialWebsite"} />
                </a>
                <div className="tooltip">{SOCIAL_LABELS[social.platform] || social.platform}</div>
              </li>
            ))}
          </ul>
        </div>

        {PUBLIC_FOOTER_COLUMNS.map((col) => (
          <div className="vh-footer-col" key={col.title}>
            <h4>{col.title}</h4>
            <div className="vh-footer-col-links">
              {col.links.map((link) => (
                <Link key={link.label} to={link.url}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="vh-footer-bottom">
        <span>© {new Date().getFullYear()} Visa House IELTS LMS. All rights reserved.</span>
        <div className="vh-footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
        </div>
      </div>
    </footer>
  );
}
