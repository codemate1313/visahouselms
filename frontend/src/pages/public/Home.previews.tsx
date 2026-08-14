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

export function StepCardVisualPreview({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="vh-step-card-ui-mockup vh-step-premium-widget">
        <div className="vh-mockup-header">
          <div className="vh-mockup-tag">
            <span className="vh-mockup-dot-active" />
            <span>EXAM SIMULATION HUD</span>
          </div>
          <div className="vh-mockup-timer-clean">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>01:54:20</span>
          </div>
        </div>

        <div className="vh-mockup-body">
          <div className="vh-mockup-audio-card">
            <div className="vh-mockup-audio-top">
              <div className="vh-mockup-audio-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <span>Section 2: Academic Conversation</span>
              </div>
              <div className="vh-mockup-wave-mini">
                <span style={{ height: "45%" }} />
                <span style={{ height: "85%" }} />
                <span style={{ height: "60%" }} />
                <span style={{ height: "100%" }} />
                <span style={{ height: "70%" }} />
                <span style={{ height: "90%" }} />
                <span style={{ height: "50%" }} />
              </div>
            </div>
            <div className="vh-mockup-scrubber">
              <div className="vh-mockup-scrubber-fill" style={{ width: "62%" }} />
            </div>
            <div className="vh-mockup-audio-meta">
              <span>04:12</span>
              <span>12:00</span>
            </div>
          </div>

          <div className="vh-mockup-status-row">
            <span className="vh-mockup-status-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Auto-saved 2s ago</span>
            </span>
            <span className="vh-mockup-status-sep">·</span>
            <span className="vh-mockup-status-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Proctored & Monitored</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="vh-step-card-ui-mockup vh-step-premium-widget">
        <div className="vh-mockup-header">
          <div className="vh-mockup-tag">
            <span className="vh-mockup-dot-star" />
            <span>AI & EXAMINER AUDIT</span>
          </div>
          <div className="vh-mockup-score-clean">Band 8.0 · C1</div>
        </div>

        <div className="vh-mockup-body">
          <div className="vh-mockup-skill-bars">
            <div className="vh-mockup-bar-item">
              <div className="vh-mockup-bar-meta">
                <span>Listening Comprehension</span>
                <strong>8.5</strong>
              </div>
              <div className="vh-mockup-track">
                <div className="vh-mockup-fill" style={{ width: "94%" }} />
              </div>
            </div>
            <div className="vh-mockup-bar-item">
              <div className="vh-mockup-bar-meta">
                <span>Speaking Fluency & Accuracy</span>
                <strong>8.0</strong>
              </div>
              <div className="vh-mockup-track">
                <div className="vh-mockup-fill" style={{ width: "88%" }} />
              </div>
            </div>
          </div>

          <div className="vh-mockup-criteria-clean">
            <span>Fluency <strong>8.5</strong></span>
            <span className="sep">·</span>
            <span>Grammar <strong>8.0</strong></span>
            <span className="sep">·</span>
            <span>Pronunciation <strong>8.0</strong></span>
            <span className="sep">·</span>
            <span>Lexical <strong>7.5</strong></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vh-step-card-ui-mockup vh-step-premium-widget">
      <div className="vh-mockup-header">
        <div className="vh-mockup-tag">
          <span className="vh-mockup-dot-trend" />
          <span>PERFORMANCE TRAJECTORY</span>
        </div>
        <div className="vh-mockup-trend-clean">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <span>+1.5 Bands</span>
        </div>
      </div>

      <div className="vh-mockup-body">
        <div className="vh-mockup-growth-clean">
          <div className="vh-growth-col initial">
            <span className="lbl">Initial Assessment</span>
            <span className="val">Band 6.5</span>
            <span className="sub">CEFR B2</span>
          </div>
          <div className="vh-growth-divider">
            <div className="line" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="vh-growth-col target">
            <span className="lbl">Target Mastered</span>
            <span className="val">Band 8.0</span>
            <span className="sub">CEFR C1</span>
          </div>
        </div>

        <div className="vh-growth-footnote">
          <span className="dot" />
          <span>Target band achieved in 3 weeks across 8 full-length simulated mocks</span>
        </div>
      </div>
    </div>
  );
}
