import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";
import { useSEO } from "@/hooks/useSEO";
import { useContactSettings } from "./useContactSettings";
import "@/styles/public/chrome.css";
import "@/styles/public/about.css";

const STATS = [
  { value: "15K+", label: "Students prepared" },
  { value: "180+", label: "Partner institutes" },
  { value: "98.4%", label: "Target band rate" },
  { value: "4.9/5", label: "User satisfaction" },
];

const MISSION_POINTS = ["Examiner-authored question banks", "CEFR-aligned proficiency profile", "Institute-only leaderboards & branding"];

const TIMELINE = [
  { year: "2019", title: "Started", desc: "Paper mocks turned digital in a Bangalore classroom." },
  { year: "2021", title: "AI feedback", desc: "First writing rubric prototype shipped to partner institutes." },
  { year: "2023", title: "Speaking AI", desc: "Fluency and pronunciation evaluator moved to production." },
  { year: "2026", title: "Global", desc: "180+ institutes across India, UAE and Southeast Asia." },
];

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
  useSEO({ title: "About Us", description: "Visa House started as a small team of IELTS trainers frustrated by paper mocks. Today we power computer-delivered simulation and AI feedback for institutes across three continents." });
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
            Built for institutes.
            <span className="vh-accent"> Trusted by educators.</span>
          </h1>
          <p>
            Visa House started as a small team of IELTS trainers frustrated by paper mocks. Today we power computer-delivered simulation and AI feedback for
            institutes across three continents.
          </p>
        </section>

        <section className="vh-about-stats vh-reveal">
          <div className="vh-about-stats-grid">
            {STATS.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </div>
        </section>

        <section className="vh-about-mission vh-reveal">
          <div>
            <h2>
              Test day should feel like <span className="vh-accent">just another mock</span>.
            </h2>
            <p>We build the environment, the audio, the timer and the marking pipeline that lets students walk into the real IELTS having already sat forty of them.</p>
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
          <div className="vh-about-mission-photo">
            <img src="/images/about_team.jpg" alt="Visa House team working together around a table" />
          </div>
        </section>

        <section className="vh-about-timeline vh-reveal">
          <div className="vh-about-timeline-intro">

            <h2>Where we have been</h2>
          </div>
          <div className="vh-about-timeline-grid">
            {TIMELINE.map((item) => (
              <div className="vh-timeline-card vh-reveal" key={item.year}>
                <div className="vh-timeline-year">{item.year}</div>
                <div className="vh-timeline-title">{item.title}</div>
                <div className="vh-timeline-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <PublicCtaBanner
          heading="Ready to bring Visa House to your institute?"
          body="Book a walkthrough with our partnerships team — see the platform, the pricing and a live student cohort."
          primary={{ label: authCtaLabel, onClick: goAuth }}
          secondary={{ label: "Talk to sales", href: "/contact" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
