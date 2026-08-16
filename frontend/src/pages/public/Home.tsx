import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { AuthOverlay } from "@/components/publicSite/AuthOverlay";
import { InstitutePlanBanner } from "@/components/publicSite/InstitutePlanBanner";
import { InstagramFeedSection } from "@/components/publicSite/InstagramFeedSection";
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
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [isTestimonialHovered, setIsTestimonialHovered] = useState(false);
  const [blogPreviews, setBlogPreviews] = useState<BlogListItem[]>([]);

  const stepsContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const featuresSectionRef = useRef<HTMLElement | null>(null);
  const testimonialsSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = featuresSectionRef.current;
    if (!section) return;

    gsap.registerPlugin(ScrollTrigger);

    const cards = gsap.utils.toArray<HTMLElement>(".vh-prag-card", section);
    if (!cards.length) return;

    const ctx = gsap.context(() => {
      const introEl = section.querySelector(".vh-section-intro");
      const gridEl = section.querySelector(".vh-modules-grid");
      const leftCards = gsap.utils.toArray<HTMLElement>(".vh-prag-col-left", section);
      const rightCards = gsap.utils.toArray<HTMLElement>(".vh-prag-col-right", section);

      if (introEl) {
        gsap.fromTo(
          introEl,
          { opacity: 0, y: 45 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "power2.out",
            scrollTrigger: {
              trigger: introEl,
              start: "top 88%",
              toggleActions: "restart none none reverse",
            },
          }
        );
      }

      const cardsTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: gridEl || section,
          start: "top 86%",
          toggleActions: "restart none none reverse",
        },
      });

      // Left Column cards glide up dramatically from bottom first
      if (leftCards.length) {
        cardsTimeline.fromTo(
          leftCards,
          {
            opacity: 0,
            y: 130,
            scale: 0.92,
            filter: "blur(4px)",
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.1,
            stagger: 0.22,
            ease: "power3.out",
            clearProps: "all",
          },
          0
        );
      }

      // Right Column cards follow right after with distinct column stagger
      if (rightCards.length) {
        cardsTimeline.fromTo(
          rightCards,
          {
            opacity: 0,
            y: 140,
            scale: 0.92,
            filter: "blur(4px)",
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.1,
            stagger: 0.22,
            ease: "power3.out",
            clearProps: "all",
          },
          0.28
        );
      }
    }, section);

    return () => ctx.revert();
  }, []);

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

    // 1. Initial Scroll Entrance Animation (Left sidebar from Left, Right Card Stage from Right)
    const eyebrowEl = container.querySelector(".vh-steps-eyebrow");
    const headingEl = container.querySelector(".vh-steps-sidebar h2");
    const subtitleEl = container.querySelector(".vh-steps-subtitle");
    const navItems = gsap.utils.toArray<HTMLElement>(".vh-stepper-item-wrapper", container);
    const rightStage = container.querySelector(".vh-steps-cards-stage");

    const entranceTl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    if (eyebrowEl) {
      entranceTl.fromTo(
        eyebrowEl,
        { opacity: 0, x: -75 },
        { opacity: 1, x: 0, duration: 0.75, ease: "power3.out" },
        0
      );
    }

    if (headingEl) {
      entranceTl.fromTo(
        headingEl,
        { opacity: 0, x: -85, filter: "blur(4px)" },
        { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.85, ease: "power3.out" },
        0.08
      );
    }

    if (subtitleEl) {
      entranceTl.fromTo(
        subtitleEl,
        { opacity: 0, x: -75 },
        { opacity: 1, x: 0, duration: 0.75, ease: "power2.out" },
        0.15
      );
    }

    if (navItems.length) {
      entranceTl.fromTo(
        navItems,
        { opacity: 0, x: -80 },
        { opacity: 1, x: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" },
        0.2
      );
    }

    if (rightStage) {
      entranceTl.fromTo(
        rightStage,
        { opacity: 0, x: 95, rotateY: -10, rotateZ: 2.5, scale: 0.92, filter: "blur(6px)" },
        { opacity: 1, x: 0, rotateY: 0, rotateZ: 0, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "power4.out" },
        0.1
      );
    }

    // 2. Setup pinned sliding cards
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
      entranceTl.kill();
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
    fetch(`${API_BASE_URL}/testimonials`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTestimonials(Array.isArray(data) ? mapTestimonials(data) : []))
      .catch(() => setTestimonials([]));
  }, []);

  useEffect(() => {
    const section = testimonialsSectionRef.current;
    if (!section || !testimonials.length) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const eyebrow = section.querySelector(".vh-testimonials-eyebrow");
      const title = section.querySelector(".vh-testimonials-header-wrap h2");
      const desc = section.querySelector(".vh-testimonials-header-wrap p");
      const stage = section.querySelector(".vh-3d-coverflow-wrapper");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 82%",
          toggleActions: "play none none reverse",
        },
      });

      if (eyebrow) {
        tl.fromTo(
          eyebrow,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.75, ease: "power3.out" },
          0
        );
      }

      if (title) {
        tl.fromTo(
          title,
          { opacity: 0, y: 32, filter: "blur(4px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.85, ease: "power3.out" },
          0.08
        );
      }

      if (desc) {
        tl.fromTo(
          desc,
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" },
          0.16
        );
      }

      if (stage) {
        tl.fromTo(
          stage,
          { opacity: 0, y: 50, scale: 0.94, filter: "blur(6px)" },
          { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.05, ease: "power4.out" },
          0.12
        );
      }
    }, section);

    return () => ctx.revert();
  }, [testimonials.length]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragDataRef = useRef<{
    startX: number;
    startTime: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    isDragging: boolean;
    hasMoved: boolean;
  }>({
    startX: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    isDragging: false,
    hasMoved: false,
  });
  const [isDragging, setIsDragging] = useState(false);

  // Autoplay every 3 seconds (3000ms), paused only on card hover or active dragging
  useEffect(() => {
    if (!testimonials.length || isTestimonialHovered || isDragging) return;
    const timer = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [testimonials.length, isTestimonialHovered, isDragging]);

  const wheelLockRef = useRef(false);

  // Mac Trackpad two-finger swipe handler (moves 1 card smoothly per swipe)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !testimonials.length) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 8) {
        e.preventDefault();
        if (wheelLockRef.current) return;
        wheelLockRef.current = true;

        if (e.deltaX > 0) {
          setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
        } else {
          setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
        }

        setTimeout(() => {
          wheelLockRef.current = false;
        }, 320);
      }
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
    };
  }, [testimonials.length]);

  const handleDragStart = (clientX: number) => {
    const now = performance.now();
    dragDataRef.current = {
      startX: clientX,
      startTime: now,
      lastX: clientX,
      lastTime: now,
      velocity: 0,
      isDragging: true,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  const handleDragMove = (clientX: number) => {
    if (!dragDataRef.current.isDragging) return;
    const now = performance.now();
    const dt = now - dragDataRef.current.lastTime;
    const dx = clientX - dragDataRef.current.lastX;
    if (dt > 8) {
      dragDataRef.current.velocity = dx / dt;
      dragDataRef.current.lastX = clientX;
      dragDataRef.current.lastTime = now;
    }
    if (Math.abs(clientX - dragDataRef.current.startX) > 6) {
      dragDataRef.current.hasMoved = true;
    }
  };

  const handleDragEnd = (clientX: number) => {
    if (!dragDataRef.current.isDragging) return;
    const { startX, hasMoved } = dragDataRef.current;
    dragDataRef.current.isDragging = false;
    setIsDragging(false);

    const totalDx = clientX - startX;
    if (hasMoved && Math.abs(totalDx) > 18) {
      if (totalDx < 0) {
        setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
      } else {
        setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
      }
    }
  };

  const handleCardOrStageClick = (e: React.MouseEvent, clickedIndex?: number) => {
    if (dragDataRef.current.hasMoved) {
      e.stopPropagation();
      return;
    }
    if (!testimonials.length) return;

    if (clickedIndex !== undefined && clickedIndex !== testimonialIndex) {
      let diff = clickedIndex - testimonialIndex;
      if (diff > testimonials.length / 2) diff -= testimonials.length;
      if (diff < -testimonials.length / 2) diff += testimonials.length;

      if (diff > 0) {
        setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
      } else {
        setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
      }
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) {
      setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    } else {
      setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX);
    const onMouseMove = (moveEv: MouseEvent) => {
      handleDragMove(moveEv.clientX);
    };
    const onMouseUp = (upEv: MouseEvent) => {
      handleDragEnd(upEv.clientX);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      handleDragEnd(e.changedTouches[0].clientX);
    }
  };

  function get3DCardStyle(i: number, activeIndex: number, total: number) {
    if (!total) return {};
    let diff = i - activeIndex;

    while (diff > total / 2) diff -= total;
    while (diff <= -total / 2) diff += total;

    if (diff === 0) {
      return {
        transform: "perspective(1200px) translate3d(0%, 0, 0) rotateY(0deg) scale(1.02)",
        opacity: 1,
        zIndex: 10,
        filter: "none",
        cursor: isDragging ? "grabbing" : "grab",
        pointerEvents: "auto" as const,
      };
    }

    if (diff === -1) {
      return {
        transform: "perspective(1200px) translate3d(-54%, 0, -120px) rotateY(16deg) scale(0.85)",
        opacity: 0.65,
        zIndex: 6,
        filter: "brightness(0.85) blur(0.5px)",
        cursor: isDragging ? "grabbing" : "pointer",
        pointerEvents: "auto" as const,
      };
    }

    if (diff === 1) {
      return {
        transform: "perspective(1200px) translate3d(54%, 0, -120px) rotateY(-16deg) scale(0.85)",
        opacity: 0.65,
        zIndex: 6,
        filter: "brightness(0.85) blur(0.5px)",
        cursor: isDragging ? "grabbing" : "pointer",
        pointerEvents: "auto" as const,
      };
    }

    if (diff < -1) {
      return {
        transform: "perspective(1200px) translate3d(-105%, 0, -280px) rotateY(24deg) scale(0.65)",
        opacity: 0,
        zIndex: 1,
        filter: "brightness(0.5) blur(3px)",
        pointerEvents: "none" as const,
      };
    }

    return {
      transform: "perspective(1200px) translate3d(105%, 0, -280px) rotateY(-24deg) scale(0.65)",
      opacity: 0,
      zIndex: 1,
      filter: "brightness(0.5) blur(3px)",
      pointerEvents: "none" as const,
    };
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/blogs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlogPreviews(Array.isArray(data) ? data.slice(0, 2) : []))
      .catch(() => setBlogPreviews([]));
  }, []);

  function selectHero(index: number) {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    setHeroIndex(index);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, HERO_INTERVAL_MS);
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

        <section id="features" ref={featuresSectionRef} className="vh-modules-section">
          {/* Ambient Glows */}
          <div className="vh-modules-ambient-glow left" aria-hidden="true" />
          <div className="vh-modules-ambient-glow right" aria-hidden="true" />

          <div className="vh-section-intro">
            <span className="vh-section-kicker">Everything in one place</span>
            <h2>
              Everything you need to <span className="vh-accent">prepare with confidence</span>.
            </h2>
            <p>From realistic mock tests and skill-based practice to detailed performance tracking and feedback — everything is brought together in one place.</p>
          </div>

          <div className="vh-modules-grid">
            {EVERYTHING_CARDS.map((f, idx) => (
              <div
                className={`vh-module-card vh-prag-card ${idx % 2 === 0 ? "vh-prag-col-left" : "vh-prag-col-right"}`}
                key={f.num}
                style={{ "--card-accent": f.g1 } as React.CSSProperties}
              >
                <div className="vh-module-card-top">
                  <div className="vh-prag-number-wrapper">
                    <span className="vh-prag-number">{parseInt(f.num, 10)}</span>
                  </div>
                  <div className="vh-module-card-icon" style={{ color: f.g1 }}>
                    <ModuleIcon kind={f.kind === "mocks" ? "listening" : f.kind === "listening_reading" ? "reading" : f.kind === "writing" ? "writing" : f.kind === "speaking" ? "speaking" : "reading"} />
                  </div>
                </div>

                <div className="vh-module-card-content">
                  <div className="vh-module-eyebrow">Feature {f.num}</div>
                  <h3 className="vh-module-title">{f.title}</h3>
                </div>

                <div
                  className="vh-module-preview vh-folder-tab-left"
                  style={{ background: `linear-gradient(135deg, ${f.wash1}, ${f.wash2})` }}
                >
                  <ModulePreview kind={f.kind === "mocks" ? "listening" : f.kind === "listening_reading" ? "reading" : f.kind === "writing" ? "writing" : f.kind === "speaking" ? "speaking" : "reading"} color={f.g1} />
                </div>

                <p className="vh-module-desc">{f.desc}</p>
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
                  From first mock to<br />
                  <span className="vh-gradient-text-light">target band in 3 steps</span>
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
                          <div className="vh-steps-nav-arrow-circle">
                            <svg className="vh-steps-nav-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </div>
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
        
        {/* Instagram Reels & Posts Showcase */}
        <InstagramFeedSection />

        <section ref={testimonialsSectionRef} className="vh-testimonials-section">
          <div className="vh-testimonials-header-wrap">
            <span className="vh-testimonials-eyebrow">Student Success Stories</span>
            <h2>
              Trusted by <span className="vh-accent">LanguageCert</span> candidates
            </h2>
            <p>
              Read real experiences from students who used Visa House LMS to prepare for their LanguageCert exam and achieve their target results.
            </p>
          </div>
          {testimonials.length > 0 ? (
            <div
              className="vh-3d-coverflow-wrapper"
              onMouseEnter={() => setIsTestimonialHovered(true)}
              onMouseLeave={() => setIsTestimonialHovered(false)}
            >
              <div
                ref={stageRef}
                className={`vh-3d-coverflow-stage ${isDragging ? "is-dragging" : ""}`}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={(e) => handleCardOrStageClick(e)}
              >
                {testimonials.map((t, i) => {
                  const style = get3DCardStyle(i, testimonialIndex, testimonials.length);
                  const isCenter = i === testimonialIndex;
                  return (
                    <div
                      key={i}
                      className={`vh-testimonial-card vh-3d-card ${isCenter ? "is-center" : ""}`}
                      style={style}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardOrStageClick(e, i);
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
                  );
                })}
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
              {blogPreviews.slice(0, 2).map((post) => (
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
