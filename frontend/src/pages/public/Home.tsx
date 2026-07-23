import { useEffect, useRef, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import gsap from "gsap";
import { TextPlugin } from "gsap/TextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(TextPlugin, ScrollTrigger);

interface LandingContext {
  openLoginModal: () => void;
}

interface AnimatedStatProps {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
  trailing?: string;
  duration?: number;
}

function AnimatedStat({
  value,
  label,
  suffix = "",
  decimals = 0,
  trailing = "",
  duration = 1500,
}: AnimatedStatProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      setHasEntered(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  useEffect(() => {
    if (!hasEntered) return undefined;

    let frameId = 0;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(value * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [duration, hasEntered, value]);

  const formattedValue = displayValue.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div ref={ref} className={`stat-card ${hasEntered ? "stat-card-visible" : ""}`}>
      <h3 className="stat-number" aria-label={`${formattedValue}${suffix}${trailing} ${label}`}>
        <span className="stat-number-roll">{formattedValue}</span>
        {suffix && <span className="stat-number-affix">{suffix}</span>}
        {trailing && <span className="stat-number-trailing">{trailing}</span>}
      </h3>
      <p className="stat-label">{label}</p>
    </div>
  );
}

export function Home() {
  const { openLoginModal } = useOutletContext<LandingContext>();
  const [activeShowcaseDetail, setActiveShowcaseDetail] = useState<string | null>(null);
  const [expandedFeatureModule, setExpandedFeatureModule] = useState<string | null>(null);

  const toggleModuleExpand = (moduleKey: string) => {
    setExpandedFeatureModule((prev) => (prev === moduleKey ? null : moduleKey));
  };
  const typewriterRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const parallaxContainerRef = useRef<HTMLElement | null>(null);
  const parallaxImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!typewriterRef.current) return;
    
    const ctx = gsap.context(() => {
      const target = typewriterRef.current!;
      const originalText = `& AI Feedback`;
      
      // Clear initially
      target.textContent = "";
      
      // Typewriter effect: types out once, then stays permanently without deleting
      const tl = gsap.timeline({ delay: 0.3 });
      tl.to(target, {
        text: { value: originalText },
        duration: 1.8,
        ease: "none"
      });
      
      // Parallax effect
      if (parallaxContainerRef.current && parallaxImgRef.current) {
        gsap.fromTo(
          parallaxImgRef.current,
          { yPercent: -20 },
          {
            yPercent: 0,
            ease: "none",
            scrollTrigger: {
              trigger: parallaxContainerRef.current,
              start: "top bottom",
              end: "top top",
              scrub: true
            }
          }
        );
      }
    }, titleRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div className="landing-page home-page" ref={titleRef as any}>
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
            Master IELTS with <span className="text-gradient" data-text="Real Exam Simulations">Real Exam Simulations</span><br />
            <span style={{ position: "relative", display: "inline-block" }}>
              <span style={{ visibility: "hidden" }}>&amp; AI Feedback</span>
              <span ref={typewriterRef} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}></span>
            </span>
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
          <div
            className="hero-3d-showcase"
            onPointerLeave={() => setActiveShowcaseDetail(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setActiveShowcaseDetail(null);
              }
            }}
          >
            <div className="showcase-card-container">
              {/* Central Mock Screen */}
              <div
                className="mock-exam-screen"
                tabIndex={0}
              >
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
                        <label className="mock-opt selected">
                          <input type="radio" readOnly checked />
                          <span>A. Adjusting solar tracking angles</span>
                        </label>
                        <label className="mock-opt">
                          <input type="radio" readOnly />
                          <span>B. Storing excess geothermal heat</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating 3D Badge 1: AI Speaking Evaluator */}
              <div
                className="floating-badge badge-top-right"
                tabIndex={0}
                onPointerEnter={() => setActiveShowcaseDetail("speaking")}
                onPointerLeave={() => setActiveShowcaseDetail(null)}
                onFocus={() => setActiveShowcaseDetail("speaking")}
                onBlur={() => setActiveShowcaseDetail(null)}
              >
                <div className="badge-icon-wrap bg-rose">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
                <div className="badge-text-box">
                  <span className="badge-title">AI Speaking Evaluator</span>
                  <span className="badge-sub">Band 7.5 • Fluency &amp; Pronunciation</span>
                </div>

                {/* 3 Outward Floating Cloud Feature Pills for Speaking */}
                <div className={`feature-cloud-card cloud-1 speaking-cloud-1 ${activeShowcaseDetail === "speaking" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-rose-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Fluency &amp; Cadence</strong>
                    <span>Pause &amp; hesitation detection</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-2 speaking-cloud-2 ${activeShowcaseDetail === "speaking" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-rose-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Phoneme Accuracy</strong>
                    <span>Acoustic score &amp; accent fit</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-3 speaking-cloud-3 ${activeShowcaseDetail === "speaking" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-rose-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Pace &amp; Rhythm</strong>
                    <span>Words-per-min intonation</span>
                  </div>
                </div>
              </div>

              {/* Floating 3D Badge 2: Instant Writing Assessment */}
              <div
                className="floating-badge badge-bottom-left"
                tabIndex={0}
                onPointerEnter={() => setActiveShowcaseDetail("writing")}
                onPointerLeave={() => setActiveShowcaseDetail(null)}
                onFocus={() => setActiveShowcaseDetail("writing")}
                onBlur={() => setActiveShowcaseDetail(null)}
              >
                <div className="badge-icon-wrap bg-indigo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <div className="badge-text-box">
                  <span className="badge-title">Writing Task 2 Feedback</span>
                  <span className="badge-sub">Grammar &amp; Task Response Analyzed</span>
                </div>

                {/* 3 Outward Floating Cloud Feature Pills for Writing */}
                <div className={`feature-cloud-card cloud-1 writing-cloud-1 ${activeShowcaseDetail === "writing" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-indigo-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Task Coverage</strong>
                    <span>Essay structure &amp; prompt fit</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-2 writing-cloud-2 ${activeShowcaseDetail === "writing" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-indigo-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Grammar Engine</strong>
                    <span>Instant highlights &amp; rewrites</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-3 writing-cloud-3 ${activeShowcaseDetail === "writing" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-indigo-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Lexical Resource</strong>
                    <span>Advanced vocabulary score</span>
                  </div>
                </div>
              </div>

              {/* Floating 3D Badge 3: Institute Analytics */}
              <div
                className="floating-badge badge-bottom-right"
                tabIndex={0}
                onPointerEnter={() => setActiveShowcaseDetail("analytics")}
                onPointerLeave={() => setActiveShowcaseDetail(null)}
                onFocus={() => setActiveShowcaseDetail("analytics")}
                onBlur={() => setActiveShowcaseDetail(null)}
              >
                <div className="badge-icon-wrap bg-emerald">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div className="badge-text-box">
                  <span className="badge-title">Institute Analytics</span>
                  <span className="badge-sub">150+ Batch Students Tracked</span>
                </div>

                {/* 3 Outward Floating Cloud Feature Pills for Analytics */}
                <div className={`feature-cloud-card cloud-1 analytics-cloud-1 ${activeShowcaseDetail === "analytics" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-emerald-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>150+ Students</strong>
                    <span>Live cohort &amp; CEFR progress</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-2 analytics-cloud-2 ${activeShowcaseDetail === "analytics" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-emerald-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>Weak Area Detector</strong>
                    <span>Automated skill gap alerts</span>
                  </div>
                </div>

                <div className={`feature-cloud-card cloud-3 analytics-cloud-3 ${activeShowcaseDetail === "analytics" ? "is-active" : ""}`}>
                  <div className="cloud-icon-box bg-emerald-sub">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div className="cloud-text-box">
                    <strong>One-Click Reports</strong>
                    <span>Exportable PDF report cards</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Parallax Educational Image Section */}
      <section className="landing-parallax-section" ref={parallaxContainerRef}>
        <div className="parallax-overlay" />
        <img
          ref={parallaxImgRef}
          src="/educational-hero.png"
          alt="Students studying collaboratively"
          className="parallax-img"
        />
        <div className="parallax-content">
          <h2>Empowering the Next Generation</h2>
          <p>State-of-the-art tools for modern educators and ambitious students.</p>
        </div>
      </section>

      {/* Stats Counter Section */}
      <section className="landing-stats-section">
        <div className="stats-container">
          <AnimatedStat value={15000} suffix="+" label="Students Prepared" />
          <div className="stat-divider" />
          <AnimatedStat value={180} suffix="+" label="Partner Institutes" />
          <div className="stat-divider" />
          <AnimatedStat value={98.4} suffix="%" decimals={1} label="Target Band Rate" />
          <div className="stat-divider" />
          <AnimatedStat value={4.9} decimals={1} trailing=" / 5.0" label="Average User Score" />
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
          <div
            className={`feature-card red-accent-card ${expandedFeatureModule === "listening" ? "is-expanded" : ""}`}
            onClick={() => toggleModuleExpand("listening")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleModuleExpand("listening"); }}
          >
            {/* Front Main Content (Crimson Front Card) */}
            <div className="card-front-content">
              <div className="feature-icon bg-rose">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <h3 className="feature-title">Listening Simulations</h3>
              <p className="feature-desc">
                High-fidelity audio playback with native accents, section progress &amp; answer autocommit.
              </p>
              <div className="card-expand-action">
                <span>{expandedFeatureModule === "listening" ? "Hide Details ▲" : "Click for Specs ↓"}</span>
              </div>
            </div>

            {/* Revealable Back Detail Panel */}
            <div className="card-back-details">
              <div className="back-details-badge">MODULE SPECS &amp; DEEP DIAGNOSTICS</div>
              <ul className="back-spec-list">
                <li><strong>Native Accents:</strong> British, Australian, North American &amp; Indian tracks</li>
                <li><strong>Audio Engine:</strong> Speed scaling (0.75x–1.5x), waveform seeker &amp; autocommit</li>
                <li><strong>Diagnostics:</strong> Instant script alignment &amp; section band breakdown</li>
              </ul>
            </div>
          </div>

          {/* Card 2 */}
          <div
            className={`feature-card red-accent-card ${expandedFeatureModule === "reading" ? "is-expanded" : ""}`}
            onClick={() => toggleModuleExpand("reading")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleModuleExpand("reading"); }}
          >
            {/* Front Main Content (Crimson Front Card) */}
            <div className="card-front-content">
              <div className="feature-icon bg-indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <h3 className="feature-title">Reading Passages</h3>
              <p className="feature-desc">
                Split-screen passage view with text highlighter, T/F/NG, Matching &amp; summary completion.
              </p>
              <div className="card-expand-action">
                <span>{expandedFeatureModule === "reading" ? "Hide Details ▲" : "Click for Specs ↓"}</span>
              </div>
            </div>

            {/* Revealable Back Detail Panel */}
            <div className="card-back-details">
              <div className="back-details-badge">MODULE SPECS &amp; DEEP DIAGNOSTICS</div>
              <ul className="back-spec-list">
                <li><strong>Dual-Pane View:</strong> Split-screen passage with sticky questions &amp; live highlighter</li>
                <li><strong>Question Types:</strong> T/F/NG, Matching Headings, Sentence &amp; Summary completion</li>
                <li><strong>Analytics:</strong> Time-per-question tracker &amp; vocabulary lookup assistant</li>
              </ul>
            </div>
          </div>

          {/* Card 3 */}
          <div
            className={`feature-card red-accent-card ${expandedFeatureModule === "writing" ? "is-expanded" : ""}`}
            onClick={() => toggleModuleExpand("writing")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleModuleExpand("writing"); }}
          >
            {/* Front Main Content (Crimson Front Card) */}
            <div className="card-front-content">
              <div className="feature-icon bg-emerald">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="feature-title">Writing Assessor</h3>
              <p className="feature-desc">
                Task 1 (Graphs/Diagrams) &amp; Task 2 (Essays) with word counter, AI scoring &amp; grammar fixes.
              </p>
              <div className="card-expand-action">
                <span>{expandedFeatureModule === "writing" ? "Hide Details ▲" : "Click for Specs ↓"}</span>
              </div>
            </div>

            {/* Revealable Back Detail Panel */}
            <div className="card-back-details">
              <div className="back-details-badge">MODULE SPECS &amp; DEEP DIAGNOSTICS</div>
              <ul className="back-spec-list">
                <li><strong>Task 1 &amp; Task 2:</strong> Dual editor with real-time word counter &amp; prompt analyzer</li>
                <li><strong>AI Scorer:</strong> Instant breakdown across TR, CC, LR, and GRA criteria</li>
                <li><strong>Rewrite Engine:</strong> Sentence-level improvement suggestions &amp; grammar highlights</li>
              </ul>
            </div>
          </div>

          {/* Card 4 */}
          <div
            className={`feature-card red-accent-card ${expandedFeatureModule === "speaking" ? "is-expanded" : ""}`}
            onClick={() => toggleModuleExpand("speaking")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleModuleExpand("speaking"); }}
          >
            {/* Front Main Content (Crimson Front Card) */}
            <div className="card-front-content">
              <div className="feature-icon bg-amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <h3 className="feature-title">Speaking Evaluator</h3>
              <p className="feature-desc">
                Part 1-3 voice recording with instant speech-to-text, lexical density &amp; fluency scoring.
              </p>
              <div className="card-expand-action">
                <span>{expandedFeatureModule === "speaking" ? "Hide Details ▲" : "Click for Specs ↓"}</span>
              </div>
            </div>

            {/* Revealable Back Detail Panel */}
            <div className="card-back-details">
              <div className="back-details-badge">MODULE SPECS &amp; DEEP DIAGNOSTICS</div>
              <ul className="back-spec-list">
                <li><strong>Part 1, 2 &amp; 3:</strong> Cue card preparation timer &amp; full audio recording engine</li>
                <li><strong>Phoneme Specs:</strong> Pronunciation accuracy, pause cadence &amp; WPM rhythm score</li>
                <li><strong>Audio Review:</strong> Interactive transcript alignment with teacher audio commentary</li>
              </ul>
            </div>
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
