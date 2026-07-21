import { Link } from "react-router-dom";

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
              <span className="social-badge">📘 Facebook</span>
              <span className="social-badge">📸 Instagram</span>
              <span className="social-badge">💼 LinkedIn</span>
              <span className="social-badge">▶️ YouTube</span>
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
