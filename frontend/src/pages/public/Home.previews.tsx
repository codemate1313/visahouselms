import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ModuleCard } from "./Home.data";

export function ModuleIcon({ kind }: { kind: ModuleCard["kind"] }) {
  const common = { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "listening":
      return (
        <svg {...common}>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      );
    case "reading":
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "writing":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "speaking":
      return (
        <svg {...common}>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1={12} y1={19} x2={12} y2={22} />
        </svg>
      );
  }
}

export function WavePreview({ color }: { color: string }) {
  return (
    <div className="vh-preview-container vh-preview-wave">
      <div className="vh-wave-header">
        <span className="vh-wave-tag">
          <span className="vh-wave-live-dot" style={{ background: color }} />
          Audio Track · Section 1
        </span>
        <span className="vh-wave-time">01:24 / 03:30</span>
      </div>
      <div className="vh-wave-bars-row">
        {Array.from({ length: 28 }).map((_, i) => {
          const heightPct = 18 + Math.abs(Math.sin(i * 0.45)) * 68 + (i % 3) * 6;
          return (
            <div
              key={i}
              className="vh-wave-bar"
              style={{
                height: `${heightPct}%`,
                background: color,
                animationDelay: `${(i % 7) * 0.1}s`,
                animationDuration: `${0.7 + (i % 4) * 0.2}s`,
              }}
            />
          );
        })}
      </div>
      <div className="vh-wave-footer">
        <span className="vh-wave-chip">Headphones Recommended</span>
        <span className="vh-wave-chip">100% Exam Speed</span>
      </div>
    </div>
  );
}

export function ReadingPreview({ color }: { color: string }) {
  const lines = [
    { w: "92%", hi: false },
    { w: "76%", hi: true, text: "Key Evidence Highlighted" },
    { w: "96%", hi: false },
    { w: "64%", hi: false },
  ];
  return (
    <div className="vh-preview-container vh-preview-reading">
      <div className="vh-reading-header">
        <span className="vh-reading-badge" style={{ color, borderColor: `${color}44` }}>
          Passage 2 · Academic Reading
        </span>
        <span className="vh-reading-words">850 words</span>
      </div>
      <div className="vh-reading-lines">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`vh-reading-line ${l.hi ? "is-highlighted" : ""}`}
            style={{
              width: l.w,
              background: l.hi ? `linear-gradient(90deg, ${color}33, ${color}15)` : undefined,
              borderLeft: l.hi ? `3px solid ${color}` : undefined,
            }}
          >
            <div
              className="vh-reading-line-fill"
              style={{
                background: l.hi ? color : undefined,
              }}
            />
            {l.hi && <span className="vh-reading-hi-label" style={{ color }}>Answer Marker [Q14]</span>}
          </div>
        ))}
      </div>
      <div className="vh-reading-scanner-beam" style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
    </div>
  );
}

export function WritingPreview({ color }: { color: string }) {
  return (
    <div className="vh-preview-container vh-preview-writing">
      <div className="vh-writing-left">
        <div className="vh-writing-meta">
          <span className="vh-writing-tag">Task 2 · Academic Essay</span>
          <span className="vh-writing-count">268 / 250 words</span>
        </div>
        <div className="vh-writing-progress-bar">
          <div className="vh-writing-progress-fill" style={{ width: "95%", background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
        </div>
        <div className="vh-writing-criteria-row">
          <span className="vh-writing-crit">TR: 8.0</span>
          <span className="vh-writing-crit">CC: 7.5</span>
          <span className="vh-writing-crit">LR: 7.5</span>
          <span className="vh-writing-crit">GRA: 8.0</span>
        </div>
      </div>
      <div className="vh-writing-gauge-wrapper">
        <svg className="vh-writing-gauge" width="76" height="76" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
          <circle
            cx="38"
            cy="38"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="201"
            strokeDashoffset="45"
            transform="rotate(-90 38 38)"
          />
        </svg>
        <div className="vh-writing-gauge-text">
          <span className="vh-writing-gauge-num">7.5</span>
          <span className="vh-writing-gauge-sub">Band</span>
        </div>
      </div>
    </div>
  );
}

export function SpeakingPreview({ color }: { color: string }) {
  return (
    <div className="vh-preview-container vh-preview-speaking">
      <div className="vh-speaking-mic-hud">
        <div className="vh-speaking-ripple-outer" style={{ borderColor: `${color}33` }} />
        <div className="vh-speaking-ripple-inner" style={{ borderColor: `${color}66` }} />
        <div className="vh-speaking-mic-core" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, boxShadow: `0 8px 24px ${color}44` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </div>
      </div>
      <div className="vh-speaking-stats">
        <div className="vh-speaking-tag">Fluency & Pronunciation</div>
        <div className="vh-speaking-score-row">
          <span className="vh-speaking-score">8.0</span>
          <span className="vh-speaking-target">Target: 7.5+</span>
        </div>
        <div className="vh-speaking-meters">
          {["Fluency", "Lexical", "Grammar", "Pron"].map((label, idx) => (
            <div key={label} className="vh-speaking-meter-item">
              <span className="vh-speaking-meter-bar" style={{ background: idx < 3 ? color : `${color}88`, height: `${12 + idx * 4}px` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModulePreview({ kind, color }: { kind: ModuleCard["kind"]; color: string }) {
  switch (kind) {
    case "listening":
      return <WavePreview color={color} />;
    case "reading":
      return <ReadingPreview color={color} />;
    case "writing":
      return <WritingPreview color={color} />;
    case "speaking":
      return <SpeakingPreview color={color} />;
  }
}

export function StepIcon({ index }: { index: number }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (index === 0) {
    return (
      <svg {...common}>
        <circle cx={12} cy={13} r={8} />
        <path d="M12 9v4l2 2M12 2v3" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1={18} y1={20} x2={18} y2={10} />
      <line x1={12} y1={20} x2={12} y2={4} />
      <line x1={6} y1={20} x2={6} y2={14} />
    </svg>
  );
}

interface StepScreenshotData {
  src: string;
  alt: string;
  tag: string;
  timer: string;
  dotColor: string;
  footerText: string;
}

const SCREENSHOT_DATA: StepScreenshotData[] = [
  {
    src: "/images/mock_listening_test.png",
    alt: "LanguageCert Listening Test Simulation",
    tag: "LISTENING MOCK SIMULATION",
    timer: "36:59",
    dotColor: "#10b981",
    footerText: "Interactive audio controls & auto-save",
  },
  {
    src: "/images/mock_reading_test.png",
    alt: "LanguageCert Reading & Gap-Fill Engine",
    tag: "READING & GAP-FILL ENGINE",
    timer: "49:40",
    dotColor: "#b80f28",
    footerText: "Live source passage & split choice bank",
  },
  {
    src: "/images/mock_speaking_test.png",
    alt: "LanguageCert AI Speaking Interview Stage",
    tag: "AI SPEAKING INTERVIEW",
    timer: "08:51",
    dotColor: "#059669",
    footerText: "Real-time voice recording HUD & examiner",
  },
];

export function StepCardVisualPreview({ index }: { index: number }) {
  const data = SCREENSHOT_DATA[index] || SCREENSHOT_DATA[0];
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <div 
        className="vh-step-card-ui-mockup vh-step-screenshot-widget"
        onClick={() => setIsOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Inspect ${data.alt} full screen`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <div className="vh-mockup-header">
          <div className="vh-step-window-controls">
            <span className="vh-window-dot vh-dot-red" />
            <span className="vh-window-dot vh-dot-yellow" />
            <span className="vh-window-dot vh-dot-green" />
          </div>

          <div className="vh-mockup-tag">
            <span className="vh-mockup-dot-custom" style={{ background: data.dotColor }} />
            <span>{data.tag}</span>
          </div>

          <div className="vh-mockup-timer-clean">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{data.timer}</span>
          </div>
        </div>

        <div className="vh-step-screenshot-body">
          <img
            src={data.src}
            alt={data.alt}
            className="vh-step-screenshot-img"
            loading="lazy"
          />
          <div className="vh-step-screenshot-overlay">
            <span className="vh-step-inspect-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <span>Inspect Full UI</span>
            </span>
          </div>
        </div>

        <div className="vh-step-screenshot-footer">
          <div className="vh-step-footer-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{data.footerText}</span>
          </div>
          <span className="vh-step-click-hint">Click to enlarge ⤢</span>
        </div>
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="vh-screenshot-lightbox-backdrop"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="vh-screenshot-lightbox-clean"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={data.src} alt={data.alt} className="vh-lightbox-pure-img" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
