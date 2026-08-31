import { useState } from "react";
import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { RADIAL_COLORS } from "./resultRadialColors";

interface ResultRadialProps {
  metrics: AttemptMetrics;
  activeSegment?: string | null;
  onHoverSegment?: (key: string | null) => void;
}

export function ResultRadial({ metrics, activeSegment, onHoverSegment }: ResultRadialProps) {
  const [internalHover, setInternalHover] = useState<string | null>(null);
  const currentHover = activeSegment !== undefined ? activeSegment : internalHover;

  const setHover = (key: string | null) => {
    setInternalHover(key);
    onHoverSegment?.(key);
  };

  const segments = [
    { key: "correct", label: strings.metrics.correct, value: metrics.correct, color: RADIAL_COLORS.correct },
    { key: "incorrect", label: strings.metrics.incorrect, value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    { key: "pending", label: strings.metrics.awaitingReview, value: metrics.pending, color: RADIAL_COLORS.pending },
    { key: "unanswered", label: strings.metrics.unanswered, value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
  ].filter((s) => s.value > 0);

  let offset = 0;
  const activeObj = segments.find((s) => s.key === currentHover);
  const activePercent = activeObj && metrics.total > 0 ? Math.round((activeObj.value / metrics.total) * 100) : 0;

  return (
    <div className="result-radial" role="img" aria-label={`${metrics.attempted} of ${metrics.total} attempted, ${metrics.correct} correct`}>
      <div
        className={`result-radial-backdrop ${activeObj ? "is-active" : ""}`}
        style={activeObj ? { color: activeObj.color } : undefined}
        aria-hidden="true"
      />
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle className="result-radial-track" cx="110" cy="110" r="82" pathLength="100" />
        {metrics.total > 0 &&
          segments.map((segment) => {
            const percentage = (segment.value * 100) / metrics.total;
            const dashOffset = -offset;
            offset += percentage;
            const isHovered = currentHover === segment.key;
            const isDimmed = currentHover !== null && !isHovered;

            return (
              <circle
                key={segment.key}
                className={`result-radial-segment ${isHovered ? "is-hovered" : ""} ${isDimmed ? "is-dimmed" : ""}`}
                cx="110"
                cy="110"
                r="82"
                pathLength="100"
                stroke={segment.color}
                strokeDasharray={`${percentage} ${100 - percentage}`}
                strokeDashoffset={dashOffset}
                onMouseEnter={() => setHover(segment.key)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
      </svg>
      <div className="result-radial-center">
        {activeObj ? (
          <div className="result-radial-active-content" style={{ color: activeObj.color }}>
            <strong className="result-radial-active-val">{activeObj.value}</strong>
            <div className="result-radial-active-badge-wrap">
              <span className="result-radial-active-badge">{activePercent}%</span>
            </div>
            <span className="result-radial-active-lbl">
              {activeObj.label}
            </span>
          </div>
        ) : (
          <div className="result-radial-default-content">
            <strong className="result-radial-default-val">
              {metrics.attempted}
              <span className="result-radial-default-total">/{metrics.total}</span>
            </strong>
            <small className="result-radial-default-lbl">{strings.metrics.attemptedSuffix}</small>
          </div>
        )}
      </div>
    </div>
  );
}

