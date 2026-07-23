import { Link } from "react-router-dom";

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34v7.03C18.34 21.24 22 17.08 22 12.06Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="footer-ig-gradient" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="45%" stopColor="#E1306C" />
          <stop offset="100%" stopColor="#5851DB" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#footer-ig-gradient)" />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="17.35" cy="6.65" r="1.15" fill="#fff" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.12 9.4H4.4V19h2.72V9.4ZM5.76 8.24a1.58 1.58 0 1 0 0-3.16 1.58 1.58 0 0 0 0 3.16ZM19.6 19h-2.71v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V19H10.5V9.4h2.6v1.3h.04c.36-.68 1.26-1.4 2.58-1.4 2.76 0 3.27 1.82 3.27 4.18V19Z"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path fill="#fff" d="M10 8.64v6.72L16 12l-6-3.36Z" />
    </svg>
  );
}

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
              <a href="#facebook" onClick={(e) => e.preventDefault()} className="social-badge">
                <FacebookIcon /> Facebook
              </a>
              <a href="#instagram" onClick={(e) => e.preventDefault()} className="social-badge">
                <InstagramIcon /> Instagram
              </a>
              <a href="#linkedin" onClick={(e) => e.preventDefault()} className="social-badge">
                <LinkedInIcon /> LinkedIn
              </a>
              <a href="#youtube" onClick={(e) => e.preventDefault()} className="social-badge">
                <YouTubeIcon /> YouTube
              </a>
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
