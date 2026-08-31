import { useEffect, useMemo, useState } from "react";
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
  // A device clock that disagrees with the server's would otherwise start the
  // timer hours in or hours behind, so the reading is bounded by what the
  // estimate says is plausible.
  return Math.min(Math.max((now - startedMs) / 1000, 0), estimate * 3 + 600);
}

export function AiEvaluationProgress({ progress, variant = "panel" }: AiEvaluationProgressProps) {
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

  const phase = useMemo(() => {
    if (!progress) return "";
    if (overtime) return t.overtimePhases[overtimeIndex];
    const share = estimate > 0 ? elapsed / estimate : 0;
    const key = PHASES.find((entry) => share < entry.until)?.key ?? "feedback";
    // The result page is the first thing a student sees after submitting, so
    // it must not depend on a field being present to render at all.
    const listening = (progress.skills ?? []).includes("speaking");
    if (key === "reading") return listening ? t.phases.listening : t.phases.reading;
    return t.phases[key];
  }, [progress, overtime, overtimeIndex, elapsed, estimate]);

  if (!progress) return null;

  if (variant === "inline") {
    return (
      <span className="ai-progress-inline" role="timer" aria-live="off">
        <span className="ai-progress-inline-clock">{overtime ? clock(elapsed) : clock(remaining)}</span>
        <span className="ai-progress-inline-phase">{phase}</span>
      </span>
    );
  }

  const RADIUS = 34;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <section className={`ai-progress-panel ${overtime ? "is-overtime" : ""}`} aria-live="polite">
      <div className="ai-progress-dial" role="timer">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle className="ai-progress-track" cx="40" cy="40" r={RADIUS} />
          <circle
            className="ai-progress-sweep"
            cx="40"
            cy="40"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          />
        </svg>
        <div className="ai-progress-readout">
          <b>{overtime ? clock(elapsed) : clock(remaining)}</b>
          <span>{overtime ? t.elapsedLabel : t.remainingLabel}</span>
        </div>
      </div>

      <div className="ai-progress-copy">
        <h3>{t.heading}</h3>
        <p className="ai-progress-phase" key={phase}>
          {phase}
        </p>
        <p className="ai-progress-meta">
          {t.workload(progress)}
          {progress.parts_total > 1 ? ` · ${t.partsDone(progress.parts_done, progress.parts_total)}` : ""}
        </p>
      </div>
    </section>
  );
}
