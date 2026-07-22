import { useOutletContext } from "react-router-dom";

interface LandingContext {
  openLoginModal: () => void;
}

export function AboutUs() {
  const { openLoginModal } = useOutletContext<LandingContext>();

  return (
    <div className="landing-page about-page">
      {/* Background Mesh */}
      <div className="landing-ambient-orbs" aria-hidden="true">
        <div className="landing-orb orb-1" />
        <div className="landing-orb orb-2" />
      </div>

      {/* Hero Header */}
      <section className="about-hero-section text-center">
        <div className="about-hero-container">

          <h1 className="hero-main-title">
            Empowering Educators &amp; Students with <span className="text-gradient">IELTS Innovation</span>
          </h1>
          <p className="hero-description">
            IELTS LMS Pro was engineered to bridge the gap between traditional classroom coaching and real computer-delivered IELTS exam environments.
          </p>
        </div>
      </section>

      {/* Pillars Grid */}
      <section className="about-pillars-section">
        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-num">01</div>
            <h3>Authentic Exam Fidelity</h3>
            <p>
              Our exam interfaces duplicate official computer-delivered IELTS test layouts, timing rules, navigation controls, and passage highlighting.
            </p>
          </div>
          <div className="pillar-card">
            <div className="pillar-num">02</div>
            <h3>Instant AI Feedback</h3>
            <p>
              Advanced speech-to-text models and lexical density diagnostics analyze candidate attempts instantly, providing actionable band score insights.
            </p>
          </div>
          <div className="pillar-card">
            <div className="pillar-num">03</div>
            <h3>Institute Multi-Tenancy</h3>
            <p>
              Institutes receive dedicated portals, custom domain branding, instructor grading queues, and student progress oversight tools.
            </p>
          </div>
        </div>
      </section>

      {/* Pedagogy Section */}
      <section className="about-pedagogy-section">
        <div className="pedagogy-card">
          <div className="pedagogy-content">
            <span className="section-kicker">EDUCATIONAL METHODOLOGY</span>
            <h2>Scientific IELTS Preparation Architecture</h2>
            <p>
              We believe effective IELTS coaching requires continuous diagnostic evaluation, authentic practice conditions, and structured instructor oversight.
            </p>
            <div className="pedagogy-points">
              <div className="ped-point">
                <strong>Realistic Testing Environment:</strong> Students build muscle memory under authentic exam timers and keyboard shortcuts.
              </div>
              <div className="ped-point">
                <strong>Granular Criteria Breakdown:</strong> Feedback spans all 4 scoring pillars: Task Achievement, Coherence &amp; Cohesion, Lexical Resource, and Grammatical Accuracy.
              </div>
            </div>
            <div className="ped-action">
              <button type="button" className="hero-primary-btn" onClick={openLoginModal}>
                Access Portal Now →
              </button>
            </div>
          </div>
          <div className="pedagogy-graphic">
            <div className="floating-tech-badge">
              <span>⚡ 99.8% System Uptime</span>
            </div>
            <div className="floating-tech-badge badge-2">
              <span>🎯 0.2 Band Score Accuracy</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
