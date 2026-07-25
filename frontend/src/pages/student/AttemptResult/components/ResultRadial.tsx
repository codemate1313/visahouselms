import type { AttemptMetrics } from "@/pages/student/attemptMetrics";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

export const RADIAL_COLORS = {
  correct: "var(--shade-16865b)",
  incorrect: "var(--primary)",
  pending: "var(--shade-d79018)",
  unanswered: "var(--shade-d7d9df)",
};

interface ResultRadialProps {
  metrics: AttemptMetrics;
}

export function ResultRadial({ metrics }: ResultRadialProps) {
  const segments = [
    { key: "correct", value: metrics.correct, color: RADIAL_COLORS.correct },
    { key: "incorrect", value: metrics.incorrect, color: RADIAL_COLORS.incorrect },
    { key: "pending", value: metrics.pending, color: RADIAL_COLORS.pending },
    { key: "unanswered", value: metrics.unanswered, color: RADIAL_COLORS.unanswered },
  ];
  let offset = 0;

  return (
    <div className="result-radial" role="img" aria-label={`${metrics.attempted} of ${metrics.total} attempted, ${metrics.correct} correct`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="result-radial-track" cx="100" cy="100" r="76" pathLength="100" />
        {metrics.total > 0 && segments.map((segment) => {
          const percentage = segment.value * 100 / metrics.total;
          const dashOffset = -offset;
          offset += percentage;
          return (
            <circle
              key={segment.key}
              className="result-radial-segment"
              cx="100"
              cy="100"
              r="76"
              pathLength="100"
              stroke={segment.color}
              strokeDasharray={`${percentage} ${100 - percentage}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="result-radial-center">
        <strong>
          {metrics.attempted}
          <span>/{metrics.total}</span>
        </strong>
        <small>{strings.metrics.attemptedSuffix}</small>
      </div>
    </div>
  );
}
