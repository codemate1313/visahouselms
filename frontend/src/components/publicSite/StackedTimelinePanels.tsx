import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface TimelinePanelItem {
  year: string;
  number: string;
  title: string;
  desc: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  bgImage: string;
  theme: "light" | "dark" | "brand" | "navy";
}

const DEFAULT_TIMELINE_ITEMS: TimelinePanelItem[] = [
  {
    year: "2019",
    number: "1",
    title: "Visa House Begins",
    desc: "Started with a vision to help students navigate international education and test preparation with greater confidence.",
    bgColor: "#f2f7ef",
    textColor: "#142814",
    accentColor: "#264826",
    bgImage: "/images/about_team.jpg",
    theme: "light",
  },
  {
    year: "2021",
    number: "2",
    title: "Digital Preparation",
    desc: "Introduced structured online learning and digital practice to make English test preparation more accessible.",
    bgColor: "#121418",
    textColor: "#f0ede6",
    accentColor: "#d4ceb8",
    bgImage: "/images/hero_slide_1.png",
    theme: "dark",
  },
  {
    year: "2023",
    number: "3",
    title: "Smarter Feedback",
    desc: "Expanded our preparation approach with technology-driven assessment and personalised performance feedback.",
    bgColor: "#b91c2b",
    textColor: "#ffffff",
    accentColor: "rgba(255, 255, 255, 0.92)",
    bgImage: "/images/slide_ai_feedback.jpg",
    theme: "brand",
  },
  {
    year: "2026",
    number: "4",
    title: "LanguageCert LMS",
    desc: "Bringing LanguageCert preparation, realistic mock tests, expert guidance and progress tracking together in one powerful platform.",
    bgColor: "#0c1322",
    textColor: "#f8fafc",
    accentColor: "#38bdf8",
    bgImage: "/images/hero_slide_3.png",
    theme: "navy",
  },
];

interface StackedTimelinePanelsProps {
  items?: TimelinePanelItem[];
}

export function StackedTimelinePanels({ items = DEFAULT_TIMELINE_ITEMS }: StackedTimelinePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up existing ScrollTrigger instances
    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === container || st.pin === container) {
        st.kill();
      }
    });

    const panels = gsap.utils.toArray<HTMLElement>(".vh-gsap-panel", container);
    if (!panels.length) return;

    // Set initial positions: first panel is at 0, subsequent panels start below (100% yPercent)
    panels.forEach((panel, i) => {
      gsap.set(panel, {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100vh",
        yPercent: i === 0 ? 0 : 100,
        zIndex: i + 1,
      });
    });

    const numPanels = panels.length;

    // Create pinned ScrollTrigger timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: () => `+=${(numPanels - 1) * 100}%`,
        pin: true,
        pinSpacing: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const index = Math.min(
            numPanels - 1,
            Math.floor(progress * (numPanels - 1) + 0.35)
          );
          setActiveIndex(index);
        },
      },
    });

    if (tl.scrollTrigger) {
      scrollTriggerRef.current = tl.scrollTrigger;
    }

    // Animate each sliding panel from 100% down to 0% sequentially
    for (let i = 1; i < numPanels; i++) {
      tl.to(
        panels[i],
        {
          yPercent: 0,
          ease: "none",
          duration: 1,
        },
        `panel-${i}`
      );
    }

    // Refresh ScrollTrigger after layout settles
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
  }, [items]);

  const goToPanel = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const st = scrollTriggerRef.current;
    if (st && st.start !== undefined && st.end !== undefined) {
      const totalDistance = st.end - st.start;
      const targetProgress = targetIdx / (items.length - 1);
      const targetScroll = st.start + targetProgress * totalDistance;
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  };

  const currentTheme = items[activeIndex]?.theme || "light";

  return (
    <div className="vh-gsap-panels-section" ref={containerRef} data-active-index={activeIndex}>
      {/* Left Vertical Timeline Sidebar with Theme-Adaptive Colors */}
      <div className={`vh-stacked-vertical-timeline theme-${currentTheme}`}>
        <div className="vh-stacked-timeline-line">
          <div
            className="vh-stacked-timeline-progress"
            style={{
              height: `${(activeIndex / (items.length - 1)) * 100}%`,
            }}
          />
        </div>
        {items.map((item, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <button
              key={item.year}
              type="button"
              className={`vh-stacked-timeline-node-item ${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""}`}
              onClick={() => goToPanel(i)}
              title={`Jump to year ${item.year}`}
            >
              <span className="vh-stacked-node-dot">
                <span className="vh-stacked-node-inner" />
              </span>
              <span className="vh-stacked-node-year">{item.year}</span>
            </button>
          );
        })}
      </div>

      {items.map((item, index) => {
        const isDark = item.theme === "dark" || item.theme === "navy" || item.theme === "brand";
        return (
          <div
            key={item.year}
            className={`vh-gsap-panel ${isDark ? "vh-panel-dark" : "vh-panel-light"}`}
            style={{
              backgroundColor: item.bgColor,
              color: item.textColor,
              zIndex: index + 1,
            }}
          >
            {/* Low Opacity Background Image for Premium Look */}
            {item.bgImage && (
              <div
                className="vh-panel-bg-image"
                style={{
                  backgroundImage: `url(${item.bgImage})`,
                  opacity: item.theme === "light" ? 0.14 : 0.18,
                }}
              />
            )}
            <div className="vh-panel-gradient-overlay" />

            {/* Clean Header Eyebrow */}
            <div className="vh-panel-top-nav">
              <div className="vh-panel-header-badge" style={{ color: item.accentColor }}>
                WHERE WE HAVE BEEN · OUR MILESTONES
              </div>
            </div>

            {/* Central Content Box */}
            <div className="vh-panel-center-content">
              <span className="vh-panel-eyebrow" style={{ color: item.accentColor }}>
                MILESTONE {item.number} OF {items.length}
              </span>

              {/* Refined, Sleeker Year Font */}
              <h2 className="vh-panel-giant-year" style={{ color: item.textColor }}>
                {item.year}
              </h2>

              <h3 className="vh-panel-title" style={{ color: item.textColor }}>
                {item.title}
              </h3>
              <p className="vh-panel-desc" style={{ color: item.textColor }}>
                {item.desc}
              </p>
            </div>

            {/* Clean Bottom Navigation Bar */}
            <div className="vh-panel-bottom-nav">
              <div className="vh-panel-counter-badge">
                <span>0{index + 1} / 0{items.length}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
