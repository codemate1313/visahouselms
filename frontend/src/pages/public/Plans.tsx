import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";

interface LandingContext {
  openLoginModal: () => void;
}

export function Plans() {
  const { openLoginModal } = useOutletContext<LandingContext>();
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="landing-page plans-page">
      {/* Background Orbs */}
      <div className="landing-ambient-orbs" aria-hidden="true">
        <div className="landing-orb orb-1" />
        <div className="landing-orb orb-2" />
      </div>

      {/* Header */}
      <section className="plans-hero-section text-center">
        <div className="plans-hero-container">
          <span className="section-kicker">PLANS &amp; PRICING</span>
          <h1 className="hero-main-title">
            Flexible Subscription Tiers for <span className="text-gradient">Every Goal</span>
          </h1>
          <p className="hero-description">
            Choose a plan tailored for individual student preparation or full institute batch management.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="billing-toggle-container">
            <span className={`toggle-label ${!isAnnual ? "active" : ""}`}>Monthly Billing</span>
            <button
              type="button"
              className={`billing-switch ${isAnnual ? "annual" : ""}`}
              onClick={() => setIsAnnual(!isAnnual)}
              aria-label="Toggle Billing Cycle"
            >
              <span className="switch-thumb" />
            </button>
            <span className={`toggle-label ${isAnnual ? "active" : ""}`}>
              Annual Billing <span className="save-badge">SAVE 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="pricing-cards-section">
        <div className="pricing-grid">
          {/* Plan 1 */}
          <div className="pricing-card">
            <div className="plan-badge">STUDENT ESSENTIALS</div>
            <h3 className="plan-name">Student Self-Study</h3>
            <p className="plan-subtitle">Ideal for independent students practicing individual modules.</p>
            <div className="plan-price-box">
              <span className="price-currency">$</span>
              <span className="price-amount">{isAnnual ? "23" : "29"}</span>
              <span className="price-period">/ month</span>
            </div>
            <button type="button" className="plan-btn outline" onClick={openLoginModal}>
              Start Student Practice
            </button>
            <ul className="plan-features">
              <li>✓ Authentic Listening &amp; Reading Tests</li>
              <li>✓ 10 AI Speaking Voice Evaluations</li>
              <li>✓ 10 AI Writing Essay Scorer Runs</li>
              <li>✓ Personal Band Score Dashboard</li>
              <li>✓ 24/7 Web &amp; Mobile Access</li>
            </ul>
          </div>

          {/* Plan 2: Featured */}
          <div className="pricing-card featured">
            <div className="popular-ribbon">POPULAR CHOICE</div>
            <div className="plan-badge red">PRO IELTS PREP</div>
            <h3 className="plan-name">Pro Master Prep</h3>
            <p className="plan-subtitle">Complete access with unlimited AI evaluations &amp; full mock exams.</p>
            <div className="plan-price-box">
              <span className="price-currency">$</span>
              <span className="price-amount">{isAnnual ? "47" : "59"}</span>
              <span className="price-period">/ month</span>
            </div>
            <button type="button" className="plan-btn primary" onClick={openLoginModal}>
              Get Started with Pro →
            </button>
            <ul className="plan-features">
              <li>✓ Everything in Self-Study Plan</li>
              <li>✓ <strong>Unlimited AI Speaking Tests</strong></li>
              <li>✓ <strong>Unlimited AI Writing Assessments</strong></li>
              <li>✓ Full CD-IELTS Mock Exam Suite</li>
              <li>✓ Detailed Lexical &amp; Grammar Diagnostics</li>
              <li>✓ Priority Instant Scoring Queue</li>
            </ul>
          </div>

          {/* Plan 3 */}
          <div className="pricing-card">
            <div className="plan-badge dark">INSTITUTE ENTERPRISE</div>
            <h3 className="plan-name">Institute Campus</h3>
            <p className="plan-subtitle">Built for IELTS coaching centers, academies &amp; universities.</p>
            <div className="plan-price-box">
              <span className="price-currency">$</span>
              <span className="price-amount">{isAnnual ? "159" : "199"}</span>
              <span className="price-period">/ month</span>
            </div>
            <Link to="/contact" className="plan-btn outline">
              Request Institute Demo
            </Link>
            <ul className="plan-features">
              <li>✓ Dedicated Institute Portal Domain</li>
              <li>✓ Up to 100 Active Student Seats</li>
              <li>✓ Staff Instructor Grading Queue</li>
              <li>✓ Custom Logo &amp; Institute Branding</li>
              <li>✓ Student Attempt Analytics &amp; Reports</li>
              <li>✓ Dedicated Account Manager</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="matrix-section">
        <div className="matrix-container">
          <h2 className="section-title text-center">Plan Comparison Matrix</h2>
          <div className="table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Platform Feature</th>
                  <th>Student Self-Study</th>
                  <th>Pro Master Prep</th>
                  <th>Institute Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>CD-IELTS Authentic Exam Player</td>
                  <td>✓ Included</td>
                  <td>✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>AI Speaking Voice Evaluator</td>
                  <td>10 Runs / mo</td>
                  <td><strong>Unlimited</strong></td>
                  <td><strong>Unlimited</strong></td>
                </tr>
                <tr>
                  <td>AI Writing Task 1 &amp; 2 Scorer</td>
                  <td>10 Essays / mo</td>
                  <td><strong>Unlimited</strong></td>
                  <td><strong>Unlimited</strong></td>
                </tr>
                <tr>
                  <td>Instructor Manual Grading Queue</td>
                  <td>—</td>
                  <td>Optional Add-on</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>Multi-tenant Institute Portal</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>Custom Domain Branding</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓ Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
