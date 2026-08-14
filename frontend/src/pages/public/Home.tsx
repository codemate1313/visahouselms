import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { ModuleIcon, ModulePreview, StepIcon, StepCardVisualPreview } from "./Home.previews";
import type { BlogListItem } from "./blogTypes";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "@/styles/public/chrome.css";
import "@/styles/public/home.css";

gsap.registerPlugin(ScrollTrigger);

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
  const heroBgWrapperRef = useRef<HTMLDivElement | null>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [testimonials, setTestimonials] = useState<TestimonialCard[]>([]);
  const testimonialsRef = useRef<HTMLDivElement | null>(null);
  const testimonialCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const testimonialSetWidthRef = useRef(0);
  const [isTestimonialHovered, setIsTestimonialHovered] = useState(false);
  const [blogPreviews, setBlogPreviews] = useState<BlogListItem[]>([]);

  const stepsContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    const container = stepsContainerRef.current;
    if (!container) return;

    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === container || st.pin === container) {
        st.kill();
      }
    });

    const cards = gsap.utils.toArray<HTMLElement>(".vh-steps-gsap-card", container);
    if (!cards.length) return;

    cards.forEach((card, i) => {
      gsap.set(card, {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        xPercent: 0,
        yPercent: i === 0 ? 0 : 110,
        opacity: i === 0 ? 1 : 0,
        scale: i === 0 ? 1 : 0.94,
        zIndex: i + 1,
      });
    });

    const numCards = cards.length;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: () => `+=${(numCards - 1) * 100}%`,
        pin: true,
        pinSpacing: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const index = Math.min(
            numCards - 1,
            Math.floor(progress * (numCards - 1) + 0.35)
          );
          setActiveStepIndex(index);
        },
      },
    });

    if (tl.scrollTrigger) {
      scrollTriggerRef.current = tl.scrollTrigger;
    }

    for (let i = 1; i < numCards; i++) {
      tl.to(
        cards[i - 1],
        {
          yPercent: -110,
          opacity: 0,
          scale: 0.92,
          duration: 1,
          ease: "none",
        },
        `step-${i}`
      ).to(
        cards[i],
        {
          yPercent: 0,
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: "none",
        },
        `step-${i}`
      );
    }

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () => {
      clearTimeout(timer);
      tl.kill();
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
      }
    };
  }, []);

  const goToStepCard = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= STEP_CARDS.length) return;
    const st = scrollTriggerRef.current;
    if (st && st.start !== undefined && st.end !== undefined) {
      const totalDistance = st.end - st.start;
      const targetProgress = targetIdx / (STEP_CARDS.length - 1);
      const targetScroll = st.start + targetProgress * totalDistance;
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  };

  useEffect(() => {
    HERO_SLIDES.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

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
          if (heroBgWrapperRef.current) {
            const scrollY = window.scrollY;
            if (scrollY <= 1200) {
              heroBgWrapperRef.current.style.transform = `translate3d(0, ${scrollY * 0.38}px, 0)`;
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
          <div className="vh-hero-bg-wrapper" ref={heroBgWrapperRef}>
            {HERO_SLIDES.map((slide, idx) => (
              <img
                key={slide.image}
                src={slide.image}
                alt={slide.heading}
                className={`vh-hero-bg-img${idx === heroIndex ? " vh-hero-bg-img-active" : ""}`}
                aria-hidden={idx !== heroIndex}
              />
            ))}
            <div className="vh-hero-bg-overlay" aria-hidden="true" />
          </div>

          <div className="vh-hero-inner-container">
            <div className="vh-hero-content" key={heroIndex}>
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

        <section id="steps" className="vh-steps-gsap-section" ref={stepsContainerRef}>
          {/* Transparent Visa House Logo Watermark */}
          <div className="vh-steps-watermark-bg" aria-hidden="true">
            <img src="/brand/vh-mark-light.png" alt="" />
          </div>

          <div className="vh-steps-inner-container">
            {/* Left Fixed Sidebar */}
            <div className="vh-steps-sidebar">
              <div className="vh-steps-sidebar-inner">
                <span className="vh-steps-eyebrow">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                  3 SIMPLE STEPS
                </span>
                <h2>
                  From first mock to <span className="vh-gradient-text-light">target band</span> in 3 steps
                </h2>
                <p className="vh-steps-subtitle">
                  Follow a structured, exam-realistic preparation flow designed to maximize your LanguageCert score.
                </p>

                <div className="vh-steps-nav">
                  {STEP_CARDS.map((s, index) => {
                    const isActive = activeStepIndex === index;
                    const isCompleted = activeStepIndex > index;
                    return (
                      <div key={s.num} className="vh-stepper-item-wrapper">
                        {index < STEP_CARDS.length - 1 && (
                          <div className={`vh-stepper-connector ${isCompleted || isActive ? "is-filled" : ""}`}>
                            <div className="vh-stepper-connector-fill" />
                          </div>
                        )}
                        <button
                          type="button"
                          className={`vh-steps-nav-item ${isActive ? "is-active" : isCompleted ? "is-completed" : ""}`}
                          onClick={() => goToStepCard(index)}
                        >
                          <div className="vh-steps-nav-node">
                            <span className="vh-steps-nav-num">{s.num}</span>
                          </div>
                          <div className="vh-steps-nav-content-box">
                            <span className="vh-steps-nav-title">{s.title}</span>
                            <span className="vh-steps-nav-sub">{s.subtitle}</span>
                          </div>
                          <svg className="vh-steps-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column Stage: GSAP Sliding Cards */}
            <div className="vh-steps-cards-stage">
              {STEP_CARDS.map((s, i) => (
                <div
                  key={s.num}
                  className="vh-steps-gsap-card"
                >
                  <div className="vh-step-card-header">
                    <div className="vh-step-num-badge">{s.num}</div>
                    <div className="vh-step-card-icon">
                      <StepIcon index={i} />
                    </div>
                  </div>

                  <div className="vh-step-card-content">
                    <h3>{s.title}</h3>
                    <p className="vh-step-card-desc">{s.desc}</p>
                    <StepCardVisualPreview index={i} />

                    <div className="vh-step-card-points">
                      <div className="vh-step-points-title">Key Capabilities:</div>
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
              ))}
            </div>
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
