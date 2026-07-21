import { useOutletContext, Link } from "react-router-dom";

interface LandingContext {
  openLoginModal: () => void;
}

export function Home() {
  const { openLoginModal } = useOutletContext<LandingContext>();

  return (
    <div className="landing-page home-page">
      {/* Dynamic Background Mesh */}
      <div className="landing-ambient-orbs" aria-hidden="true">
        <div className="landing-orb orb-1" />
        <div className="landing-orb orb-2" />
        <div className="landing-orb orb-3" />
      </div>

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="hero-container">
          <div className="hero-badge-pill">
            <span className="pill-dot" />
            <span>AI-POWERED IELTS PLATFORM 3.0</span>
          </div>
          <h1 className="hero-main-title">
            Master IELTS with <span className="text-gradient">Real Exam Simulations</span> &amp; AI Feedback
          </h1>
          <p className="hero-description">
            Experience authentic computer-delivered IELTS environments. Powered by instant AI Speaking evaluation, automated Writing feedback, and real-time institute tracking.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="hero-primary-btn"
              onClick={openLoginModal}
            >
              <span>Sign In to Portal</span>
              <span className="btn-arrow">→</span>
            </button>
            <Link to="/plans" className="hero-secondary-btn">
              View Plans &amp; Pricing
            </Link>
          </div>

          {/* 3D Showcase Floating Elements Card */}
          <div className="hero-3d-showcase">
            <div className="showcase-card-container">
              {/* Central Mock Screen */}
              <div className="mock-exam-screen">
                <div className="mock-screen-header">
                  <div className="screen-dots">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                  </div>
                  <div className="mock-timer-badge">⏱️ Time Remaining: 58:40</div>
                  <div className="mock-candidate-badge">Candidate ID: 489201</div>
                </div>
                <div className="mock-screen-body">
                  <div className="mock-left-pane">
                    <div className="mock-tag">PART 3 • READING PASSAGE</div>
                    <h4>The Evolution of Renewable Energy Architecture</h4>
                    <p>
                      Modern sustainable architecture integrates solar kinetic facades that adjust dynamically according to solar angles throughout the day...
                    </p>
                  </div>
                  <div className="mock-right-pane">
                    <div className="question-box active">
                      <span className="q-num">Q1.</span>
                      <p>According to paragraph 2, kinetic facades primarily function by:</p>
                      <div className="option-list">
                        <label className="mock-opt selected"><input type="radio" readOnly checked /> A. Adjusting solar tracking angles</label>
                        <label className="mock-opt"><input type="radio" readOnly /> B. Storing excess geothermal heat</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating 3D Badge 1: AI Speaking Evaluator */}
              <div className="floating-badge badge-top-right">
                <div className="badge-icon-wrap bg-rose">🎙️</div>
                <div className="badge-text-box">
                  <span className="badge-title">AI Speaking Evaluator</span>
                  <span className="badge-sub">Band 7.5 • Fluency &amp; Pronunciation</span>
                </div>
              </div>

              {/* Floating 3D Badge 2: Instant Writing Assessment */}
              <div className="floating-badge badge-bottom-left">
                <div className="badge-icon-wrap bg-indigo">✍️</div>
                <div className="badge-text-box">
                  <span className="badge-title">Writing Task 2 Feedback</span>
                  <span className="badge-sub">Grammar &amp; Task Response Analyzed</span>
                </div>
              </div>

              {/* Floating 3D Badge 3: Institute Analytics */}
              <div className="floating-badge badge-bottom-right">
                <div className="badge-icon-wrap bg-emerald">📊</div>
                <div className="badge-text-box">
                  <span className="badge-title">Institute Analytics</span>
                  <span className="badge-sub">150+ Batch Students Tracked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Counter Section */}
      <section className="landing-stats-section">
        <div className="stats-container">
          <div className="stat-card">
            <h3 className="stat-number">15,000+</h3>
            <p className="stat-label">Students Prepared</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-card">
            <h3 className="stat-number">180+</h3>
            <p className="stat-label">Partner Institutes</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-card">
            <h3 className="stat-number">98.4%</h3>
            <p className="stat-label">Target Band Rate</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-card">
            <h3 className="stat-number">4.9 / 5.0</h3>
            <p className="stat-label">Average User Score</p>
          </div>
        </div>
      </section>

      {/* Key Modules Feature Grid */}
      <section className="landing-features-section">
        <div className="section-header text-center">
          <span className="section-kicker">ALL 4 IELTS MODULES</span>
          <h2 className="section-title">Designed for Realistic IELTS Success</h2>
          <p className="section-subtitle">
            Whether preparing independently or managing an entire institute batch, IELTS LMS delivers full coverage.
          </p>
        </div>

        <div className="features-grid">
          {/* Card 1 */}
          <div className="feature-card">
            <div className="feature-icon bg-rose">🎧</div>
            <h3 className="feature-title">Listening Simulations</h3>
            <p className="feature-desc">
              High-fidelity audio playback with native accents, section-by-section progress, and real-time answer autocommit.
            </p>
            <ul className="feature-bullets">
              <li>✓ Section 1-4 Authentic Audio</li>
              <li>✓ Single &amp; Multiple Choice</li>
              <li>✓ Instant Band Scoring</li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="feature-card">
            <div className="feature-icon bg-indigo">📖</div>
            <h3 className="feature-title">Reading Passages</h3>
            <p className="feature-desc">
              Split-screen passage view with text highlighter, True/False/Not Given, Matching Headings, and summary completion.
            </p>
            <ul className="feature-bullets">
              <li>✓ Academic &amp; General Training</li>
              <li>✓ Split-screen Text &amp; Questions</li>
              <li>✓ Detailed Answer Explanations</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="feature-card">
            <div className="feature-icon bg-emerald">✍️</div>
            <h3 className="feature-title">Writing Assessor</h3>
            <p className="feature-desc">
              Task 1 (Graphs/Diagrams) &amp; Task 2 (Essays) with word count counter, automatic band scoring, and grammar diagnostics.
            </p>
            <ul className="feature-bullets">
              <li>✓ Real-time Word Counter</li>
              <li>✓ Criteria-based Scoring</li>
              <li>✓ Instructor Override &amp; Feedback</li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="feature-card">
            <div className="feature-icon bg-amber">🎙️</div>
            <h3 className="feature-title">Speaking Evaluator</h3>
            <p className="feature-desc">
              Part 1-3 voice recording with instant speech-to-text transcription, lexical density analysis, and fluency scoring.
            </p>
            <ul className="feature-bullets">
              <li>✓ Cue Card Part 2 Timer</li>
              <li>✓ Pronunciation Feedback</li>
              <li>✓ Full Attempt Audio Review</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="landing-cta-banner">
        <div className="cta-banner-card">
          <div className="cta-content">
            <h2>Ready to Elevate Your IELTS Preparation?</h2>
            <p>Sign in to your portal now or explore subscription plans designed for students and institutes.</p>
          </div>
          <div className="cta-actions">
            <button type="button" className="hero-primary-btn" onClick={openLoginModal}>
              Sign In to Portal →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
