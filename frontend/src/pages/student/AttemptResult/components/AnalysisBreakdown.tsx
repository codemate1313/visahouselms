import { useState } from "react";
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

function parseMarks(marksStr: string | null): { awarded: number; max: number; isPending: boolean } {
  if (!marksStr) return { awarded: 0, max: 0, isPending: true };
  const parts = marksStr.split("/").map((s) => s.trim());
  if (parts.length === 2) {
    const awarded = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    if (!isNaN(awarded) && !isNaN(max)) {
      return { awarded, max, isPending: false };
    }
  }
  return { awarded: 0, max: 0, isPending: true };
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
  onClick,
  isClickable = false,
}: {
  label: string;
  caption?: string;
  marks?: string | null;
  percentage: string;
  status: AnalysisBandStatus;
  note?: string;
  onClick?: () => void;
  isClickable?: boolean;
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
    <div
      className={`score-dial-card is-${status} ${isClickable ? "is-clickable" : ""}`}
      onClick={onClick}
    >
      {caption && !isClickable ? <div className="score-dial-tooltip">{caption}</div> : null}
      
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

  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);

  // Group sub-parts by skill (listening, reading, writing, speaking)
  const skillGroups: Record<string, { label: string; subParts: typeof parts }> = {
    listening: { label: "Listening", subParts: [] },
    reading: { label: "Reading", subParts: [] },
    writing: { label: "Writing", subParts: [] },
    speaking: { label: "Speaking", subParts: [] },
  };

  parts.forEach((part) => {
    const s = (part.skill || "").toLowerCase();
    if (skillGroups[s]) {
      skillGroups[s].subParts.push(part);
    } else {
      const found = Object.keys(skillGroups).find((k) => s.includes(k));
      if (found) {
        skillGroups[found].subParts.push(part);
      }
    }
  });

  const aggregatedSkills = Object.entries(skillGroups)
    .filter(([_, group]) => group.subParts.length > 0)
    .map(([skillKey, group]) => {
      let totalAwarded = 0;
      let totalMax = 0;
      let isPending = false;

      group.subParts.forEach((part) => {
        if (part.status === "pending") {
          isPending = true;
        }

        if (part.total > 0) {
          totalAwarded += part.correct;
          totalMax += part.total;
        } else if (part.marks) {
          const parsed = parseMarks(part.marks);
          if (parsed.isPending) {
            isPending = true;
          } else {
            totalAwarded += parsed.awarded;
            totalMax += parsed.max;
          }
        }
      });

      const percentageVal = totalMax > 0 ? (totalAwarded / totalMax) * 100 : 0;
      const percentage = percentageVal.toFixed(1);

      let status: AnalysisBandStatus = "pending";
      if (!isPending) {
        if (percentageVal >= 75) status = "strong";
        else if (percentageVal >= 50) status = "steady";
        else status = "priority";
      }

      const marks = isPending ? "" : `${totalAwarded} / ${totalMax}`;

      return {
        skill: skillKey,
        label: group.label,
        percentage,
        marks,
        status,
        subParts: group.subParts,
        isPending,
      };
    });

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

      {aggregatedSkills.length > 0 && (
        <section className="analysis-block" aria-label={t.partBreakdown.heading}>
          <div className="analysis-block-head">
            <h3>{t.partBreakdown.heading}</h3>
            <p>{t.partBreakdown.subheading} Click any skill for a detailed part-by-part breakdown.</p>
          </div>
          <div className="analysis-score-dials-grid">
            {aggregatedSkills.map((skill) => (
              <ScoreDial
                key={skill.skill}
                label={skill.label}
                marks={skill.marks}
                percentage={skill.percentage}
                status={skill.status}
                isClickable={true}
                onClick={() => setSelectedSkill(skill)}
                note={skill.isPending ? t.partBreakdown.awaitingExaminer : undefined}
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

      {selectedSkill && (
        <div className="score-details-modal-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="score-details-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="score-details-modal-header">
              <h3>{selectedSkill.label} Breakdown</h3>
              <button className="score-details-modal-close-btn" onClick={() => setSelectedSkill(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="score-details-modal-body">
              <p className="score-details-modal-subheading">
                Every part of the {selectedSkill.label} section, what it tests, and what you scored.
              </p>
              <div className="analysis-score-dials-grid">
                {selectedSkill.subParts.map((part: any) => (
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
