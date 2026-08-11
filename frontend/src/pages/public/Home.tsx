import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { AuthOverlay } from "@/components/publicSite/AuthOverlay";
import { InstitutePlanBanner } from "@/components/publicSite/InstitutePlanBanner";
import { usePublicAuthOverlay } from "@/components/publicSite/usePublicAuthOverlay";
import { usePublicAuthAction } from "@/components/publicSite/usePublicAuthAction";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useThemeStore } from "@/store/themeStore";
import { useSEO } from "@/hooks/useSEO";
import { API_BASE_URL } from "@/api/client";
import { useContactSettings } from "./useContactSettings";
import { EVERYTHING_CARDS, HERO_SLIDES, STEP_CARDS, type TestimonialCard } from "./Home.data";
import { ModuleIcon, ModulePreview, StepIcon } from "./Home.previews";
import type { BlogListItem } from "./blogTypes";
import "@/styles/public/chrome.css";
import "@/styles/public/home.css";

const HERO_INTERVAL_MS = 4000;
const TESTIMONIAL_CARD_STEP = 384;

interface RawTestimonial {
  quote?: string;
  student_name?: string;
  student_role?: string;
  target_score?: string;
  avatar_url?: string;
}

function formatBlogDate(createdAt: string) {
  const date = createdAt ? new Date(createdAt) : new Date();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapTestimonials(raw: RawTestimonial[]): TestimonialCard[] {
  return raw.map((t) => ({
    quote: t.quote || "",
    name: t.student_name || "Student",
    role: t.student_role || "LanguageCert Candidate",
    score: t.target_score || "Target level achieved",
    init: (t.student_name || "S")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    avatar: t.avatar_url || "",
    grad: "linear-gradient(135deg, #e11d2e, #7c5cff)",
  }));
}

export function Home() {
  useSEO({});
  const navigate = useNavigate();
  const contactSettings = useContactSettings();
  const theme = useThemeStore((state) => state.theme);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRevealOnScroll(rootRef);

  const { authMode, setAuthMode, handleClose, user, isLoading } = usePublicAuthOverlay();
  const { handleAuth, showInstituteBanner, closeInstituteBanner, goToMyCourses } = usePublicAuthAction();

  const [heroIndex, setHeroIndex] = useState(0);
  const heroImageRef = useRef<HTMLImageElement | null>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [testimonials, setTestimonials] = useState<TestimonialCard[]>([]);
  const testimonialsRef = useRef<HTMLDivElement | null>(null);
  const testimonialCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const testimonialSetWidthRef = useRef(0);
  const [isTestimonialHovered, setIsTestimonialHovered] = useState(false);
  const [blogPreviews, setBlogPreviews] = useState<BlogListItem[]>([]);
  const [flippedStepCards, setFlippedStepCards] = useState<Record<string, boolean>>({});

  function toggleStepCardFlip(num: string) {
    setFlippedStepCards((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  }

  useEffect(() => {
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, HERO_INTERVAL_MS);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (heroImageRef.current) {
            const scrollY = window.scrollY;
            if (scrollY <= 1200) {
              heroImageRef.current.style.transform = `translate3d(0, ${scrollY * 0.38}px, 0) scale(1.1)`;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!heroImageRef.current) return;
    gsap.fromTo(heroImageRef.current, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1.1, duration: 0.8, ease: "power2.out" });
  }, [heroIndex]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/testimonials`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTestimonials(Array.isArray(data) ? mapTestimonials(data) : []))
      .catch(() => setTestimonials([]));
  }, []);

  useEffect(() => {
    const el = testimonialsRef.current;
    if (!el || testimonials.length === 0) return;

    function anchorToMiddleSet() {
      const firstCard = testimonialCardRefs.current[0];
      const secondSetCard = testimonialCardRefs.current[testimonials.length];
      if (!el || !firstCard || !secondSetCard) return;
      const setWidth = secondSetCard.offsetLeft - firstCard.offsetLeft;
      if (setWidth <= 0) return;
      testimonialSetWidthRef.current = setWidth;
      el.scrollLeft = setWidth;
    }

    anchorToMiddleSet();
    window.addEventListener("resize", anchorToMiddleSet);
    return () => window.removeEventListener("resize", anchorToMiddleSet);
  }, [testimonials]);

  useEffect(() => {
    const el = testimonialsRef.current;
    if (!el || testimonials.length === 0) return;

    function handleScroll() {
      const current = testimonialsRef.current;
      const setWidth = testimonialSetWidthRef.current;
      if (!current || !setWidth) return;

      // Real-time silent rebalancing:
      // When scrolled past Set 2, instantly shift back by 1 set width without visual jump.
      if (current.scrollLeft >= setWidth * 2) {
        current.scrollLeft -= setWidth;
      }
      // When scrolled before Set 1, instantly shift forward by 1 set width.
      else if (current.scrollLeft < setWidth) {
        current.scrollLeft += setWidth;
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [testimonials]);

  // Continuous smooth auto-slide ticker for testimonials
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = testimonialsRef.current;
    if (!el || testimonials.length === 0 || isTestimonialHovered) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const SPEED = 0.75; // pixels per frame for a smooth continuous glide

    function step() {
      if (testimonialsRef.current && !isTestimonialHovered) {
        testimonialsRef.current.scrollLeft += SPEED;
      }
      animFrameRef.current = requestAnimationFrame(step);
    }

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [testimonials, isTestimonialHovered]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/blogs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlogPreviews(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => setBlogPreviews([]));
  }, []);

  function selectHero(index: number) {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    setHeroIndex(index);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, HERO_INTERVAL_MS);
  }

  function scrollTestimonials(direction: 1 | -1) {
    const el = testimonialsRef.current;
    if (!el || testimonials.length === 0) return;
    const setWidth = testimonialSetWidthRef.current;
    const step = setWidth ? setWidth / testimonials.length : TESTIMONIAL_CARD_STEP;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function handleHeroCta(link: string) {
    if (link === "/login") {
      handleAuth("login");
      return;
    }
    if (link === "/register") {
      handleAuth("register");
      return;
    }
    navigate(link);
  }

  const activeSlide = HERO_SLIDES[heroIndex];
  const loopedTestimonials = testimonials.length
    ? [...testimonials, ...testimonials, ...testimonials, ...testimonials]
    : [];

  return (
    <div className="vh-public" ref={rootRef}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section id="top" className="vh-hero-section">
          <div className="vh-hero-bg-wrapper">
            <img ref={heroImageRef} key={heroIndex} src={activeSlide.image} alt={activeSlide.heading} className="vh-hero-bg-img" />
            <div className="vh-hero-bg-overlay" aria-hidden="true" />
          </div>

          <div className="vh-hero-inner-container">
            <div className="vh-hero-content">
              <span className="vh-hero-badge">{activeSlide.badge}</span>
              <h1 className="vh-public-hero-title">
                {activeSlide.heading}
                <span className="vh-public-hero-title-accent">{activeSlide.highlight}</span>
              </h1>
              <p className="vh-hero-desc">{activeSlide.desc}</p>
              <div className="vh-hero-actions">
                <button type="button" className="vh-hero-cta-solid" onClick={() => handleHeroCta(activeSlide.ctaLink)}>
                  {activeSlide.ctaText}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </button>
                {activeSlide.altLink.startsWith("#") ? (
                  <a href={activeSlide.altLink} className="vh-hero-cta-alt">
                    {activeSlide.altText}
                  </a>
                ) : (
                  <Link to={activeSlide.altLink} className="vh-hero-cta-alt">
                    {activeSlide.altText}
                  </Link>
                )}
              </div>
              <div className="vh-hero-stats">
                {activeSlide.stats.map((stat) => (
                  <div className="vh-hero-stat-group" key={stat.label}>
                    <div className="vh-hero-stat-value">{stat.value}</div>
                    <div className="vh-hero-stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="vh-hero-dots">
              <div className="vh-hero-dots-inner">
                {HERO_SLIDES.map((slide, i) => (
                  <button
                    key={slide.heading}
                    type="button"
                    className={`vh-dot${i === heroIndex ? " vh-dot-active" : ""}`}
                    aria-label={`Show slide ${i + 1}`}
                    onClick={() => selectHero(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="vh-modules-section vh-reveal">
          <div className="vh-section-intro">
            <span className="vh-section-kicker">Everything in one place</span>
            <h2>
              Everything you need to <span className="vh-accent">prepare with confidence</span>.
            </h2>
            <p>From realistic mock tests and skill-based practice to detailed performance tracking and feedback — everything is brought together in one place.</p>
          </div>
          <div className="vh-modules-grid">
            {EVERYTHING_CARDS.map((f) => (
              <div className="vh-module-card vh-reveal" key={f.num}>
                <div className="vh-module-card-head">
                  <div className="vh-module-card-head-left">
                    <div style={{ color: f.g1, display: "grid", placeItems: "center" }}>
                      <ModuleIcon kind={f.kind === "mocks" ? "listening" : f.kind === "listening_reading" ? "reading" : f.kind === "writing" ? "writing" : f.kind === "speaking" ? "speaking" : "reading"} />
                    </div>
                    <div>
                      <div className="vh-module-eyebrow">Feature {f.num}</div>
                      <h3>{f.title}</h3>
                    </div>
                  </div>
                </div>
                <div className="vh-module-preview" style={{ background: `linear-gradient(135deg, ${f.wash1}, ${f.wash2})` }}>
                  <ModulePreview kind={f.kind === "mocks" ? "listening" : f.kind === "listening_reading" ? "reading" : f.kind === "writing" ? "writing" : f.kind === "speaking" ? "speaking" : "reading"} color={f.g1} />
                </div>
                <p>{f.desc}</p>
                <div className="vh-module-card-foot">
                  <Link to={f.ctaLink} className="vh-module-try" style={{ color: f.g1 }}>
                    {f.ctaText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="steps" className="vh-steps-section vh-reveal">
          <div className="vh-steps-intro">
            <h2>From first mock to target band in three steps</h2>
          </div>
          <div className="vh-steps-grid">
            {STEP_CARDS.map((s, i) => (
              <div className="vh-reveal" key={s.num}>
                <div
                  className={`vh-flip ${flippedStepCards[s.num] ? "is-flipped" : ""}`}
                  onClick={() => toggleStepCardFlip(s.num)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleStepCardFlip(s.num);
                    }
                  }}
                >
                  <div className="vh-flip-inner">
                    <div className="vh-face vh-step-face-front">
                      <div className="vh-step-face-front-top">
                        <div className="vh-step-num-badge">{s.num}</div>
                        <div style={{ opacity: 0.75 }}>
                          <StepIcon index={i} />
                        </div>
                      </div>
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.desc}</p>
                      </div>
                      <div className="vh-step-hover-hint">
                        Click / hover for details
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                          <path d="m17 3 4 4-4 4" />
                        </svg>
                      </div>
                    </div>
                    <div className="vh-face vh-back vh-step-face-back">
                      <div className="vh-step-back-eyebrow">Step {s.num} · what you get</div>
                      {s.points.map((point) => (
                        <div className="vh-step-point" key={point}>
                          <span className="vh-step-point-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        <section
          className="vh-testimonials-section vh-reveal"
          onMouseEnter={() => setIsTestimonialHovered(true)}
          onMouseLeave={() => setIsTestimonialHovered(false)}
        >
          <div className="vh-testimonials-header-wrap">
            <div>
              <span className="vh-testimonials-eyebrow">Student Success Stories</span>
              <h2>Trusted by LanguageCert candidates</h2>
              <p>Read real experiences from students who used Visa House LMS to prepare for their LanguageCert exam and achieve their target results.</p>
            </div>
            <div className="vh-testimonial-controls">
              <button type="button" className="vh-slider-nav-btn" aria-label="Previous testimonial" onClick={() => scrollTestimonials(-1)}>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 22 6 12 16 2" />
                </svg>
              </button>
              <button type="button" className="vh-slider-nav-btn" aria-label="Next testimonial" onClick={() => scrollTestimonials(1)}>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 22 18 12 8 2" />
                </svg>
              </button>
            </div>
          </div>
          {testimonials.length > 0 ? (
            <div className="vh-testimonial-slider-wrapper" ref={testimonialsRef}>
              <div className="vh-testimonial-slider-track">
                {loopedTestimonials.map((t, i) => (
                  <div
                    className="vh-testimonial-card"
                    key={i}
                    ref={(node) => {
                      testimonialCardRefs.current[i] = node;
                    }}
                  >
                    <div>
                      <div className="vh-testimonial-header">
                        <div className="vh-testimonial-avatar" style={{ background: t.grad }}>
                          <span>{t.init}</span>
                          {t.avatar && (
                            <img
                              src={t.avatar}
                              alt={t.name}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                        </div>
                        <div className="vh-testimonial-author-info">
                          <strong>{t.name}</strong>
                          <span>{t.role}</span>
                          <div className="vh-testimonial-score-badge">{t.score}</div>
                        </div>
                      </div>
                      <p className="vh-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                    </div>
                    <div className="vh-testimonial-stars">★★★★★</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="vh-blog-empty">No student stories yet — check back soon.</div>
          )}
        </section>

        <section className="vh-blog-preview-section vh-reveal">
          <div className="vh-blog-preview-head">
            <div>
              <span className="vh-testimonials-eyebrow">Latest from our blog</span>
              <h2>Insights &amp; strategies from LanguageCert examiners</h2>
            </div>
            <Link to="/blogs" className="vh-blog-preview-view-all">
              View all blog posts
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
          {blogPreviews.length > 0 ? (
            <div className="vh-blog-preview-grid">
              {blogPreviews.map((post) => (
                <Link to={`/blogs/${post.slug}`} className="vh-blog-preview-card" key={post.id}>
                  <div className="vh-blog-preview-image">
                    <img
                      src={post.featured_image_url || "/images/blog/writing.jpg"}
                      alt={post.title}
                      onError={(e) => {
                        e.currentTarget.src = "/images/blog/writing.jpg";
                      }}
                    />
                    <span className="vh-blog-preview-tag">{post.category || "General"}</span>
                  </div>
                  <div className="vh-blog-preview-body">
                    <div>
                      <h3>{post.title}</h3>
                      <p>{post.summary}</p>
                    </div>
                    <div className="vh-blog-preview-meta">
                      <span>
                        {post.author_name || "Editorial Team"} · {formatBlogDate(post.created_at)}
                      </span>
                      <span>{post.read_time_minutes || 5} min read</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="vh-blog-empty">No blog posts yet — check back soon.</div>
          )}
        </section>

        <div id="plans">
          <PublicCtaBanner
            heading="Ready to elevate your LanguageCert preparation?"
            body="Give your institute a LanguageCert advantage. A purpose-built LMS for institutes that want more than worksheets and practice tests — with digital assessments, performance insights and a better way to prepare students."
            primary={{ label: "Book a Platform Demo →", onClick: () => navigate("/contact?tab=partner") }}
            secondary={{ label: "See plans and vouchers", href: "/plans" }}
          />
        </div>

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>

      {authMode && (
        <AuthOverlay authMode={authMode} publicTheme={theme} onClose={handleClose} onModeChange={setAuthMode} closeDisabled={Boolean(user) || isLoading} />
      )}

      {showInstituteBanner && <InstitutePlanBanner publicTheme={theme} onClose={closeInstituteBanner} onGoToCourses={goToMyCourses} />}
    </div>
  );
}
