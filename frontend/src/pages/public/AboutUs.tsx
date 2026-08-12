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
  { value: "10+", label: "Years of Experience" },
  { value: "20K+", label: "Students Prepared" },
  { value: "1000+", label: "Visa Successes" },
  { value: "4.9/5", label: "Student satisfaction" },
];

const MISSION_POINTS = ["Examiner-authored question banks", "CEFR-aligned proficiency profile", "Institute-only leaderboards & branding"];

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

function StatCard({ stat }: { stat: { value: string; label: string } }) {
  const { end, decimals, prefix, suffix } = parseStat(stat.value);
  const { ref, count } = useCountUp(end, decimals);
  const display = decimals > 0 ? count.toFixed(decimals) : Math.round(count).toString();
  return (
    <div className="vh-stat-card vh-reveal" ref={ref}>
      <div className="vh-stat-value">
        {prefix}{display}{suffix}
      </div>
      <div className="vh-stat-label">{stat.label}</div>
    </div>
  );
}

export function AboutUs() {
  useSEO({ title: "About Us", description: "A smarter way to deliver LanguageCert preparation, backed by 10+ years of Visa House immigration and education expertise." });
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
              <p>We build the environment, the audio, the timer and the marking pipeline that lets students walk into the real LanguageCert having already sat forty of them.</p>
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
          heading="One platform. Your entire LanguageCert ecosystem."
          body="From the first lesson to the final mock test, LanguageCert LMS gives your institute the infrastructure to deliver a more structured, measurable and scalable preparation experience."
          primary={{ label: authCtaLabel, onClick: goAuth }}
          secondary={{ label: "Book a Private Demo →", href: "/contact?form=partner" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
