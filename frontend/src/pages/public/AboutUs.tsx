import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { StackedTimelinePanels } from "@/components/publicSite/StackedTimelinePanels";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";
import { useSEO } from "@/hooks/useSEO";
import { useContactSettings } from "./useContactSettings";
import "@/styles/public/chrome.css";
import "@/styles/public/about.css";

const STATS = [
  {
    value: "10+",
    label: "Years of Experience",
    sublabel: "Student Training & Exam Preparation",
    icon: "award",
  },
  {
    value: "20K+",
    label: "Students Prepared",
    sublabel: "Across Full-Length Mock Tests",
    icon: "users",
  },
  {
    value: "1000+",
    label: "Visa Successes",
    sublabel: "Worldwide Global Student Visas",
    icon: "globe",
  },
  {
    value: "4.9/5",
    label: "Student Satisfaction",
    sublabel: "From Verified Candidate Reviews",
    icon: "star",
  },
];

const MISSION_POINTS = [
  "Realistic task architecture & exam-style distractors",
  "Timed computer-based experience & full mock simulations",
  "Skill-specific & progressive practice",
  "CEFR-aligned difficulty with detailed performance analysis",
];

function StatIcon({ name }: { name: string }) {
  if (name === "award") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Parses a stat string like "15K+", "98.4%", "4.9/5" into parts for animation */
function parseStat(raw: string): { end: number; decimals: number; prefix: string; suffix: string } {
  // Extract the leading number (may have decimals)
  const match = raw.match(/^([^\d]*?)([\d.]+)(.*)$/);
  if (!match) return { end: 0, decimals: 0, prefix: "", suffix: raw };
  const [, prefix, numStr, suffix] = match;
  const end = parseFloat(numStr);
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return { end, decimals, prefix, suffix };
}

function useCountUp(target: number, decimals: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const startTime = performance.now();
        function tick(now: number) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // easeOutExpo
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setCount(parseFloat((eased * target).toFixed(decimals)));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, decimals, duration]);

  return { ref, count };
}

function StatCard({ stat }: { stat: typeof STATS[number] }) {
  const { end, decimals, prefix, suffix } = parseStat(stat.value);
  const { ref, count } = useCountUp(end, decimals);
  const display = decimals > 0 ? count.toFixed(decimals) : Math.round(count).toString();
  return (
    <div className="vh-stat-card vh-reveal" ref={ref}>
      <div className="vh-stat-top-row">
        <span className="vh-stat-icon-badge">
          <StatIcon name={stat.icon} />
        </span>
      </div>
      <div className="vh-stat-value">
        {prefix}{display}{suffix}
      </div>
      <div className="vh-stat-label">{stat.label}</div>
      <div className="vh-stat-sublabel">{stat.sublabel}</div>
    </div>
  );
}

export function AboutUs() {
  useSEO({ title: "About Us", description: "A smarter way to deliver LanguageCert preparation, backed by 10+ years of Visa House student training and education expertise." });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const contactSettings = useContactSettings();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useRevealOnScroll(rootRef);

  const authCtaLabel = user ? "Go to dashboard →" : "Sign in to portal →";
  const goAuth = () => navigate(user ? destinationFor(user) ?? "/" : "/login");

  return (
    <div className="vh-public" ref={rootRef}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-page-hero">
          <h1>
            A smarter way to deliver
            <span className="vh-accent"> LanguageCert </span>
            preparation.
          </h1>
          <p>
            LanguageCert LMS is a purpose-built SaaS platform for language training institutes that brings teaching, practice, assessment and student performance
            into one connected ecosystem.
          </p>
        </section>

        <section className="vh-about-stats vh-reveal">
          <div className="vh-about-stats-grid">
            {STATS.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>
        </section>

        <section className="vh-about-mission">
          <div className="vh-parallax-bg" />
          <div className="vh-about-mission-overlay" />
          <div className="vh-about-mission-container vh-reveal">
            <div className="vh-about-mission-content">
              <h2>
                Test day should feel like <span className="vh-accent">just another mock</span>.
              </h2>
              <div className="vh-mission-checklist">
                {MISSION_POINTS.map((point) => (
                  <div className="vh-mission-checklist-item" key={point}>
                    <span className="vh-check-badge">
                      <CheckIcon />
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* GSAP Full-Width Stacked Panels Timeline (Cards coming from bottom on scroll) */}
        <StackedTimelinePanels />

        <PublicCtaBanner
          heading="One platform. Complete preparation."
          body="Structured mock tests, instant AI feedback, and student tracking in one powerful ecosystem."
          primary={{ label: authCtaLabel, onClick: goAuth }}
          secondary={{ label: "Book a Demo →", href: "/contact?tab=partner" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
