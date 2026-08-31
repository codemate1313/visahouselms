import { useEffect, useId, useMemo, useState } from "react";
import type { AiEvaluationProgress as Progress } from "@/api/types";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

/**
 * The wait while the AI marks, as a clock rather than three dots.
 *
 * The estimate is the server's, sized from what this student actually
 * submitted - 80 words and a four-minute recording are not the same wait - so
 * the countdown means something. The line underneath follows the same clock:
 * each phase is where the evaluation should be by now, not decorative text on
 * a loop. Once the estimate is spent the clock counts up instead of sitting at
 * zero, because pretending to be finished is worse than admitting it is slow.
 */

interface AiEvaluationProgressProps {
  progress: Progress | null;
  /** "panel" is the full card in the analysis section; "inline" is the compact
   *  clock that sits beside the status line in the page header. */
  variant?: "panel" | "inline";
  /** Optional informational message from server (e.g. retry / background update notice). */
  statusNote?: string | null;
}

const t = strings.aiEvaluation.progress;

/** Phase boundaries as a share of the estimate, in order. */
const PHASES: { until: number; key: keyof typeof t.phases }[] = [
  { until: 0.08, key: "collecting" },
  { until: 0.25, key: "reading" },
  { until: 0.45, key: "language" },
  { until: 0.65, key: "rubric" },
  { until: 0.85, key: "band" },
  { until: Infinity, key: "feedback" },
];

const OVERTIME_ROTATE_MS = 7000;

function clock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/** Ticks once a second while an evaluation is in flight. */
function useElapsedSeconds(startedAt: string | null | undefined, estimate: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startedMs = startedAt ? new Date(startedAt).getTime() : Number.NaN;
  if (Number.isNaN(startedMs)) return 0;
  return Math.min(Math.max((now - startedMs) / 1000, 0), estimate * 3 + 600);
}

function PhaseIcon({ phaseKey }: { phaseKey: string }) {
  if (phaseKey === "listening") {
    return (
      <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 2a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M16 8v2a6 6 0 0 1-12 0V8" />
        <line x1="10" y1="16" x2="10" y2="19" />
      </svg>
    );
  }
  if (phaseKey === "reading") {
    return (
      <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2H17v14.5a1.5 1.5 0 0 1-1.5 1.5H5.5A2.5 2.5 0 0 1 3 15.5V4.5Z" />
        <path d="M7 6h6M7 10h4" />
      </svg>
    );
  }
  if (phaseKey === "language") {
    return (
      <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 13 4-8 4 8M6.5 10h5" />
        <path d="M15 15a3 3 0 0 0 0-6h-2v6h2Z" />
      </svg>
    );
  }
  if (phaseKey === "rubric") {
    return (
      <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 2v16M4 7l6-3 6 3M4 13l6 3 6-3" />
      </svg>
    );
  }
  if (phaseKey === "band") {
    return (
      <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="8" r="5" />
        <path d="m6.5 12-2 6 5.5-2.5 5.5 2.5-2-6" />
      </svg>
    );
  }
  return (
    <svg className="ai-phase-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10 2 2.2 4.8L17 7.5l-3.5 3.4.8 5.1-4.3-2.4L5.7 16l.8-5.1L3 7.5l4.8-.7L10 2Z" />
    </svg>
  );
}

export function AiEvaluationProgress({ progress, variant = "panel", statusNote }: AiEvaluationProgressProps) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9-_]/g, "");
  const gradientId = `ai-sweep-grad-${safeId}`;
  const glowFilterId = `ai-glow-filter-${safeId}`;

  const estimate = progress?.estimated_seconds ?? 0;
  const elapsed = useElapsedSeconds(progress?.started_at, estimate);
  const [overtimeIndex, setOvertimeIndex] = useState(0);

  const remaining = Math.max(estimate - elapsed, 0);
  const overtime = estimate > 0 && elapsed >= estimate;
  const percent = estimate > 0 ? Math.min((elapsed / estimate) * 100, 100) : 0;

  useEffect(() => {
    if (!overtime) return;
    const timer = window.setInterval(
      () => setOvertimeIndex((current) => (current + 1) % t.overtimePhases.length),
      OVERTIME_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [overtime]);

  const { phase, phaseKey } = useMemo(() => {
    if (!progress) return { phase: "", phaseKey: "collecting" };
    if (overtime) {
      return { phase: t.overtimePhases[overtimeIndex], phaseKey: "overtime" };
    }
    const share = estimate > 0 ? elapsed / estimate : 0;
    const key = PHASES.find((entry) => share < entry.until)?.key ?? "feedback";
    const listening = (progress.skills ?? []).includes("speaking");
    if (key === "reading" && listening) {
      return { phase: t.phases.listening, phaseKey: "listening" };
    }
    return { phase: t.phases[key], phaseKey: key };
  }, [progress, overtime, overtimeIndex, elapsed, estimate]);

  if (!progress) return null;

  if (variant === "inline") {
    return (
      <span className={`ai-progress-inline ${overtime ? "is-overtime" : ""}`} role="timer" aria-live="off">
        <span className="ai-live-beacon" aria-hidden="true" />
        <span className="ai-progress-inline-clock">{overtime ? clock(elapsed) : clock(remaining)}</span>
        <span className="ai-progress-inline-sep" aria-hidden="true">·</span>
        <span className="ai-progress-inline-phase">{phase}</span>
      </span>
    );
  }

  const RADIUS = 37;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <section className={`ai-progress-panel ${overtime ? "is-overtime" : ""}`} aria-live="polite">
      {/* Decorative Radial Dial */}
      <div className="ai-progress-dial" role="timer">
        <div className="ai-progress-dial-backdrop" aria-hidden="true" />
        <svg viewBox="0 0 92 92" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {overtime ? (
                <>
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="var(--institute-primary, var(--primary, #0284c7))" />
                  <stop offset="100%" stopColor="color-mix(in srgb, var(--institute-primary, var(--primary, #0284c7)) 65%, #38bdf8)" />
                </>
              )}
            </linearGradient>
            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Dial Track */}
          <circle className="ai-progress-track" cx="46" cy="46" r={RADIUS} />

          {/* Active Sweep with Dynamic Gradient */}
          <circle
            className="ai-progress-sweep"
            cx="46"
            cy="46"
            r={RADIUS}
            stroke={`url(#${gradientId})`}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            filter={`url(#${glowFilterId})`}
          />
        </svg>

        {/* Center Countdown Readout */}
        <div className="ai-progress-readout">
          <b className="ai-progress-time">{overtime ? clock(elapsed) : clock(remaining)}</b>
          <span className="ai-progress-time-sub">{overtime ? t.elapsedLabel : t.remainingLabel}</span>
        </div>
      </div>

      {/* Structured Content Copy */}
      <div className="ai-progress-copy">
        {/* Header with Live Status Beacon & Counter Badge */}
        <div className="ai-progress-header-row">
          <div className="ai-progress-live-pill">
            <span className="ai-live-beacon" aria-hidden="true" />
            <span className="ai-live-label">{overtime ? "DEEP ANALYSIS" : "AI MARKING IN PROGRESS"}</span>
          </div>
          {progress.parts_total > 1 && (
            <span className="ai-progress-parts-badge">
              {t.partsDone(progress.parts_done, progress.parts_total)}
            </span>
          )}
        </div>

        {/* Heading */}
        <h3 className="ai-progress-title">{t.heading}</h3>

        {/* Active Phase Card */}
        <div className="ai-progress-phase-box">
          <div className="ai-progress-phase-icon-wrap" aria-hidden="true">
            <PhaseIcon phaseKey={phaseKey} />
          </div>
          <p className="ai-progress-phase-text" key={phase}>
            {phase}
          </p>
        </div>

        {/* Visual Segmented Progress Bar (when multiple parts) */}
        {progress.parts_total > 1 ? (
          <div className="ai-progress-segments-wrap">
            <div className="ai-progress-segments-bar" role="progressbar" aria-valuenow={progress.parts_done} aria-valuemin={0} aria-valuemax={progress.parts_total}>
              {Array.from({ length: progress.parts_total }, (_, idx) => {
                const isDone = idx < progress.parts_done;
                const isCurrent = idx === progress.parts_done;
                return (
                  <span
                    key={idx}
                    className={`ai-progress-seg ${isDone ? "is-done" : isCurrent ? "is-active" : "is-pending"}`}
                    title={`Section ${idx + 1} of ${progress.parts_total}`}
                  />
                );
              })}
            </div>
            <div className="ai-progress-meta-row">
              <span className="ai-progress-workload-text">{t.workload(progress)}</span>
              <span className="ai-progress-percent-text">{Math.round(percent)}%</span>
            </div>
          </div>
        ) : (
          <p className="ai-progress-meta">{t.workload(progress)}</p>
        )}

        {/* Status / Auto-update Notification Footnote */}
        {statusNote && (
          <div className="ai-progress-status-strip">
            <svg className="ai-progress-status-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 0 1 9.35-3.9M13.5 8a5.5 5.5 0 0 1-9.35 3.9" />
              <polyline points="13.5 4.5 13.5 8 10 8" />
              <polyline points="2.5 11.5 2.5 8 6 8" />
            </svg>
            <span>{statusNote}</span>
          </div>
        )}
      </div>
    </section>
  );
}

