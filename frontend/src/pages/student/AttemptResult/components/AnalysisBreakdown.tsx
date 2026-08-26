import type { AnalysisBandStatus, StudentResultAnalysis } from "@/api/types";
import { attemptResultStrings as strings } from "../AttemptResult.strings";

const t = strings.analysis;

function statusLabel(status: AnalysisBandStatus): string {
  return t.statusLabels[status] ?? t.statusLabels.pending;
}

/** `100.0` reads as 100 next to a label; the service keeps one decimal on the
 *  wire so a 14.3% is not rounded away. */
function trim(value: string | null | undefined): string {
  if (!value) return "0";
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

function barWidth(percentage: string): string {
  const value = Number(percentage);
  return `${Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))}%`;
}

/** A labelled score row with a status-tinted meter - the shape every
 *  breakdown below shares, so a part, a format and a rubric criterion all read
 *  the same way down the panel. */
function ScoreRow({
  label,
  caption,
  marks,
  percentage,
  status,
  note,
}: {
  label: string;
  caption?: string;
  marks?: string | null;
  percentage: string;
  status: AnalysisBandStatus;
  note?: string;
}) {
  return (
    <div className={`analysis-score-row is-${status}`}>
      <div className="analysis-score-row-head">
        <strong>{label}</strong>
        <span className="analysis-score-row-value">
          {marks ? <span className="analysis-score-marks">{marks}</span> : null}
          {status === "pending" ? statusLabel(status) : `${trim(percentage)}%`}
        </span>
      </div>
      {caption ? <p className="analysis-score-row-caption">{caption}</p> : null}
      <div className="analysis-skill-track">
        <span style={{ width: status === "pending" ? "0%" : barWidth(percentage) }} />
      </div>
      {note ? <p className="analysis-score-row-note">{note}</p> : null}
    </div>
  );
}

function ScoreDial({
  label,
  caption,
  marks,
  percentage,
  status,
  note,
}: {
  label: string;
  caption?: string;
  marks?: string | null;
  percentage: string;
  status: AnalysisBandStatus;
  note?: string;
}) {
  const isPending = status === "pending";
  const pct = isPending ? 0 : Number(percentage);
  const radius = 22;
  const strokeWidth = 4.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;

  let strokeColor = "#e2e8f0";
  if (status === "strong") strokeColor = "#1f7a4d";
  if (status === "steady") strokeColor = "#d97706";
  if (status === "priority") strokeColor = "var(--primary)";

  return (
    <div className={`score-dial-card is-${status}`}>
      {caption ? <div className="score-dial-tooltip">{caption}</div> : null}
      
      <div className="score-dial-visual">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isPending ? circumference : strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
          />
        </svg>
        <div className="score-dial-percent">
          {isPending ? (
            <span className="score-dial-pending-dot" />
          ) : (
            `${trim(percentage)}%`
          )}
        </div>
      </div>

      <div className="score-dial-info">
        <div className="score-dial-label">{label}</div>
        <div className="score-dial-marks-row">
          {marks ? <span className="score-dial-marks">{marks}</span> : null}
          {isPending && <span className="score-dial-pending-text">{statusLabel(status)}</span>}
        </div>
        {note ? <div className="score-dial-note">{note}</div> : null}
      </div>
    </div>
  );
}

export function AnalysisBreakdown({ analysis }: { analysis: StudentResultAnalysis }) {
  const progression = analysis.progression;
  const focusAreas = analysis.focus_areas ?? [];
  const parts = analysis.part_breakdown ?? [];
  const questionTypes = analysis.question_type_breakdown ?? [];
  const difficulties = analysis.difficulty_breakdown ?? [];
  const criteria = analysis.criteria_breakdown ?? [];
  const pacing = analysis.pacing;

  return (
    <>
      {progression && (
        <div className="analysis-progression" aria-label={t.progression.heading}>
          <div className="analysis-progression-levels">
            <span className="analysis-progression-level">
              <small>{t.progression.currentPrefix}</small>
              {progression.current_level}
            </span>
            <div className="analysis-progression-track">
              <span
                style={{
                  width: progression.target_score
                    ? `${Math.min(100, (Number(progression.current_score) / Number(progression.target_score)) * 100)}%`
                    : "100%",
                }}
              />
            </div>
            <span className="analysis-progression-level is-next">
              <small>{t.progression.nextPrefix}</small>
              {progression.next_level ?? progression.current_level}
            </span>
          </div>
          <p>
            {progression.next_level && progression.points_to_next
              ? t.progression.pointsAway(
                  trim(progression.points_to_next),
                  progression.next_level,
                  `${trim(progression.current_score)}%`,
                )
              : t.progression.atCeiling}
          </p>
        </div>
      )}

      {focusAreas.length > 0 && (
        <section className="analysis-block" aria-label={t.focusAreas.heading}>
          <div className="analysis-block-head">
            <h3>{t.focusAreas.heading}</h3>
            <p>{t.focusAreas.subheading}</p>
          </div>
          <ol className="analysis-focus-list">
            {focusAreas.map((area) => (
              <li key={area.title}>
                <strong>{area.title}</strong>
                <p>{area.detail}</p>
                {area.action ? (
                  <p className="analysis-focus-action">
                    <span>{t.focusAreas.actionLabel}</span>
                    {area.action}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {parts.length > 0 && (
        <section className="analysis-block" aria-label={t.partBreakdown.heading}>
          <div className="analysis-block-head">
            <h3>{t.partBreakdown.heading}</h3>
            <p>{t.partBreakdown.subheading}</p>
          </div>
          <div className="analysis-score-dials-grid">
            {parts.map((part) => (
              <ScoreDial
                key={part.part_code || part.label}
                label={part.label}
                caption={part.focus}
                marks={part.marks}
                percentage={part.percentage}
                status={part.status}
                note={
                  part.status === "pending"
                    ? t.partBreakdown.awaitingExaminer
                    : part.unanswered
                      ? t.partBreakdown.unansweredSuffix(part.unanswered)
                      : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {(questionTypes.length > 0 || difficulties.length > 0) && (
        <div className="analysis-block-grid">
          {questionTypes.length > 0 && (
            <section className="analysis-block" aria-label={t.questionTypes.heading}>
              <div className="analysis-block-head">
                <h3>{t.questionTypes.heading}</h3>
              </div>
              <div className="analysis-score-list">
                {questionTypes.map((row) => (
                  <ScoreRow
                    key={row.type}
                    label={row.label}
                    caption={row.tests ? `${t.questionTypes.testsPrefix} ${row.tests}.` : undefined}
                    marks={`${row.correct} / ${row.total}`}
                    percentage={row.percentage}
                    status={row.status}
                  />
                ))}
              </div>
            </section>
          )}

          {difficulties.length > 0 && (
            <section className="analysis-block" aria-label={t.difficulty.heading}>
              <div className="analysis-block-head">
                <h3>{t.difficulty.heading}</h3>
              </div>
              <div className="analysis-score-list">
                {difficulties.map((row) => (
                  <ScoreRow
                    key={row.difficulty}
                    label={row.label}
                    marks={`${row.correct} / ${row.total}`}
                    percentage={row.percentage}
                    status={row.status}
                  />
                ))}
              </div>
              {pacing?.note ? (
                <p className="analysis-pacing">
                  <strong>{t.pacing.heading}</strong>
                  {t.pacing.used(pacing.minutes_used, pacing.minutes_allowed)} - {pacing.note}
                </p>
              ) : null}
            </section>
          )}
        </div>
      )}

      {criteria.length > 0 && (
        <section className="analysis-block" aria-label={t.criteria.heading}>
          <div className="analysis-block-head">
            <h3>{t.criteria.heading}</h3>
            <p>{t.criteria.subheading}</p>
          </div>
          <div className="analysis-score-list">
            {criteria.map((row) => (
              <ScoreRow
                key={`${row.part_label}-${row.criterion}`}
                label={`${row.criterion} · ${row.part_label}`}
                marks={row.marks}
                percentage={row.percentage}
                status={row.status}
                note={row.status === "priority" ? row.action : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
