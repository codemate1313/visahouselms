import { Link } from "react-router-dom";

const socialLinks = [
  {
    label: "Facebook",
    className: "social-facebook",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.92 3.78-3.92 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.77l-.44 2.91h-2.33V22A10.03 10.03 0 0 0 22 12.06Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    className: "social-instagram",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7.3a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    className: "social-linkedin",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.95v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.32 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.02H3.54V9H7.1v11.45ZM22.22 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    className: "social-youtube",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
      </svg>
    ),
  },
];

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-container">
        <div className="landing-footer-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <Link to="/" className="landing-brand-logo footer-logo">
              <div className="brand-icon-box">
                <span className="brand-dot" />
                <span className="brand-icon-text">IELTS</span>
              </div>
              <span className="brand-title">LMS <span className="brand-title-accent">PRO</span></span>
            </Link>
            <p className="footer-brand-desc">
              The premier AI-powered IELTS preparation platform for institutes and direct students. Authentic exam simulation, automated speaking evaluation, and instant writing feedback.
            </p>
            <div className="footer-social-links">
              {socialLinks.map((item) => (
                <span key={item.label} className={`social-badge ${item.className}`}>
                  <span className="social-icon-wrap">{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4 className="footer-col-title">Showcase</h4>
            <ul className="footer-links-list">
              <li><Link to="/">Platform Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/plans">Plans &amp; Pricing</Link></li>
              <li><Link to="/contact">Contact Support</Link></li>
            </ul>
          </div>

          {/* Portals */}
          <div className="footer-col">
            <h4 className="footer-col-title">Access Portals</h4>
            <ul className="footer-links-list">
              <li><Link to="/login?role=STUDENT">Student Portal</Link></li>
              <li><Link to="/login?role=INSTITUTE_ADMIN">Institute Portal</Link></li>
              <li><Link to="/login?role=INST_INSTRUCTOR">Instructor Portal</Link></li>
              <li><Link to="/super-admin/login">Platform Admin</Link></li>
            </ul>
          </div>

          {/* Contact / Newsletter */}
          <div className="footer-col footer-newsletter-col">
            <h4 className="footer-col-title">Institute Partnerships</h4>
            <p className="footer-newsletter-text">
              Want to deploy IELTS LMS for your institute or training center?
            </p>
            <Link to="/contact" className="footer-partner-btn">
              Request Partner Demo →
            </Link>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="footer-bottom-row">
          <p>© {new Date().getFullYear()} IELTS LMS Pro Platform. All rights reserved.</p>
          <div className="footer-legal-links">
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <span>•</span>
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <span>•</span>
            <a href="#security" onClick={(e) => e.preventDefault()}>Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
