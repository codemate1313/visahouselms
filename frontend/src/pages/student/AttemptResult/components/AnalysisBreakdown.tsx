import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AnalysisBandStatus, StudentResultAnalysis } from "@/api/types";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { IconButton } from "@/components/ui/IconButton/IconButton";

const t = strings.analysis;

/** "6 / 8" as a pair, for the collapsed group's running total. */
function marksFrom(marks: string): [number, number] {
  const [awarded, maximum] = String(marks).split("/").map((part) => Number(part.trim()));
  return [Number.isFinite(awarded) ? awarded : 0, Number.isFinite(maximum) ? maximum : 0];
}

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
  stepIndex,
  marks,
  percentage,
  status,
  note,
  onClick,
  isClickable = false,
  isLarge = false,
}: {
  label: string;
  stepIndex?: number;
  marks?: string | null;
  percentage: string;
  status: AnalysisBandStatus;
  note?: string;
  onClick?: () => void;
  isClickable?: boolean;
  isLarge?: boolean;
}) {
  const isPending = status === "pending";
  const pct = isPending ? 0 : Number(percentage);
  const radius = isLarge ? 32 : 24;
  const strokeWidth = isLarge ? 4 : 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, pct)) / 100) * circumference;
  const svgSize = isLarge ? 76 : 56;
  const center = isLarge ? 38 : 28;

  let strokeColor = "#cbd5e1";
  if (status === "strong") {
    strokeColor = "#10b981";
  } else if (status === "steady") {
    strokeColor = "#f59e0b";
  } else if (status === "priority") {
    strokeColor = "#f43f5e";
  }

  return (
    <div
      className={`score-dial-card is-${status} ${isClickable ? "is-clickable" : ""} ${isLarge ? "is-large" : ""}`}
      onClick={onClick}
    >
      {/* Top Header with Step indicator */}
      {isLarge ? (
        <div className="score-dial-card-head">
          <div className="score-dial-step-tag">
            {typeof stepIndex === "number" && (
              <span className="score-dial-step-num">{String(stepIndex).padStart(2, "0")}</span>
            )}
            <span className="score-dial-part-name">{label}</span>
          </div>
        </div>
      ) : null}

      <div className="score-dial-visual">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="score-dial-track"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={isPending ? circumference : strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className="score-dial-ring"
          />
        </svg>
        <div className="score-dial-percent">
          {isPending ? (
            <span className="score-dial-pending-dot" />
          ) : (
            <>
              <span className="score-dial-percent-number">{trim(percentage)}</span>
              <span className="score-dial-percent-sign">%</span>
            </>
          )}
        </div>
      </div>

      <div className="score-dial-info">
        {!isLarge && <div className="score-dial-label">{label}</div>}
        <div className="score-dial-marks-row">
          {marks ? (
            <span className="score-dial-marks-badge">
              <strong>{marks}</strong>
              <small>marks</small>
            </span>
          ) : null}
          {isPending && <span className="score-dial-pending-text">{statusLabel(status)}</span>}
        </div>
        {note ? <div className="score-dial-note">{note}</div> : null}
      </div>
    </div>
  );
}

function CriterionIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("task") || lower.includes("fulfilment") || lower.includes("effect") || lower.includes("achievement")) {
    return (
      <span className="rubric-icon is-task" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </span>
    );
  }
  if (lower.includes("coherence") || lower.includes("cohesion") || lower.includes("link")) {
    return (
      <span className="rubric-icon is-coherence" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </span>
    );
  }
  if (lower.includes("grammar") || lower.includes("accuracy") || lower.includes("structure")) {
    return (
      <span className="rubric-icon is-grammar" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </span>
    );
  }
  if (lower.includes("vocabulary") || lower.includes("lexical") || lower.includes("lexicon")) {
    return (
      <span className="rubric-icon is-vocab" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </span>
    );
  }
  // Default / Fluency / Pronunciation
  return (
    <span className="rubric-icon is-fluency" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </span>
  );
}

function RubricMatrixTable({ criteria }: { criteria: NonNullable<StudentResultAnalysis["criteria_breakdown"]> }) {
  const skills = Array.from(new Set(criteria.map((c) => c.skill || "general")));
  const [activeSkill, setActiveSkill] = useState<string>(skills[0] || "general");

  const filteredCriteria = criteria.filter((c) => (c.skill || "general") === activeSkill);

  // Natural numeric sort for parts: Speaking 1, Speaking 2, Speaking 3, Speaking 4
  const parts = Array.from(new Set(filteredCriteria.map((c) => c.part_label))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  const criteriaNames = Array.from(new Set(filteredCriteria.map((c) => c.criterion)));

  const cellMap: Record<string, Record<string, (typeof filteredCriteria)[0]>> = {};
  const rowTotals: Record<string, { awarded: number; max: number }> = {};
  const colTotals: Record<string, { awarded: number; max: number }> = {};
  let grandAwarded = 0;
  let grandMax = 0;

  criteriaNames.forEach((name) => {
    rowTotals[name] = { awarded: 0, max: 0 };
    cellMap[name] = {};
  });
  parts.forEach((p) => {
    colTotals[p] = { awarded: 0, max: 0 };
  });

  filteredCriteria.forEach((item) => {
    cellMap[item.criterion] = cellMap[item.criterion] || {};
    cellMap[item.criterion][item.part_label] = item;

    const [awarded, max] = marksFrom(item.marks);
    if (rowTotals[item.criterion]) {
      rowTotals[item.criterion].awarded += awarded;
      rowTotals[item.criterion].max += max;
    }
    if (colTotals[item.part_label]) {
      colTotals[item.part_label].awarded += awarded;
      colTotals[item.part_label].max += max;
    }
    grandAwarded += awarded;
    grandMax += max;
  });

  const [hoveredCell, setHoveredCell] = useState<{
    item: (typeof filteredCriteria)[0];
    rect: DOMRect;
  } | null>(null);

  const isAbove = hoveredCell ? hoveredCell.rect.top > 170 : true;

  return (
    <div className="rubric-matrix-container">
      {/* Skill Tabs if multiple skills exist */}
      {skills.length > 1 && (
        <div className="rubric-matrix-tabs">
          {skills.map((s) => (
            <button
              key={s}
              type="button"
              className={`rubric-matrix-tab ${activeSkill === s ? "is-active" : ""}`}
              onClick={() => {
                setActiveSkill(s);
                setHoveredCell(null);
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} Rubric
            </button>
          ))}
        </div>
      )}

      {/* Matrix Table */}
      <div className="rubric-matrix-table-wrap">
        <table className="rubric-matrix-table">
          <thead>
            <tr>
              <th className="rubric-col-criterion">
                <span>Rubric Criteria</span>
              </th>
              {parts.map((p) => {
                const colTotal = colTotals[p];
                const pct = colTotal && colTotal.max > 0 ? (colTotal.awarded / colTotal.max) * 100 : 0;
                const status = pct >= 75 ? "strong" : pct >= 50 ? "steady" : "priority";
                return (
                  <th key={p} className="rubric-col-part">
                    <div className="rubric-part-header-card">
                      <span className="rubric-part-name">{p}</span>
                      <span className={`rubric-part-tag is-${status}`}>
                        {colTotal?.awarded ?? 0}/{colTotal?.max ?? 0} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  </th>
                );
              })}
              <th className="rubric-col-total">
                <span>Overall</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {criteriaNames.map((criterion) => {
              const rowTotal = rowTotals[criterion] || { awarded: 0, max: 0 };
              const rowPct = rowTotal.max > 0 ? (rowTotal.awarded / rowTotal.max) * 100 : 0;
              const rowStatus: AnalysisBandStatus = rowPct >= 75 ? "strong" : rowPct >= 50 ? "steady" : "priority";

              return (
                <tr key={criterion}>
                  <td className="rubric-cell-criterion">
                    <div className="rubric-criterion-label-wrap">
                      <CriterionIcon name={criterion} />
                      <strong className="rubric-criterion-name">{criterion}</strong>
                    </div>
                  </td>
                  {parts.map((part) => {
                    const item = cellMap[criterion]?.[part];
                    if (!item) {
                      return (
                        <td key={part} className="rubric-cell-score is-empty">
                          <span className="rubric-empty-dash">—</span>
                        </td>
                      );
                    }
                    const isHovered =
                      hoveredCell?.item.part_label === item.part_label &&
                      hoveredCell?.item.criterion === item.criterion;

                    return (
                      <td key={part} className="rubric-cell-score">
                        <button
                          type="button"
                          className={`rubric-score-badge is-${item.status} ${isHovered ? "is-selected" : ""} ${item.action ? "has-action" : ""}`}
                          onMouseEnter={(e) => {
                            setHoveredCell({
                              item,
                              rect: e.currentTarget.getBoundingClientRect(),
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          onFocus={(e) => {
                            setHoveredCell({
                              item,
                              rect: e.currentTarget.getBoundingClientRect(),
                            });
                          }}
                          onBlur={() => setHoveredCell(null)}
                          title={item.action ? `View feedback: ${item.action}` : `${item.marks}`}
                        >
                          <span className="rubric-score-marks">{item.marks}</span>
                        </button>
                      </td>
                    );
                  })}
                  <td className="rubric-cell-total">
                    <div className={`rubric-overall-pill is-${rowStatus}`}>
                      <span className="rubric-overall-marks">
                        {rowTotal.awarded} / {rowTotal.max}
                      </span>
                      <div className="rubric-overall-track">
                        <div
                          className={`rubric-overall-bar is-${rowStatus}`}
                          style={{ width: `${Math.min(100, Math.max(0, rowPct))}%` }}
                        />
                      </div>
                      <span className="rubric-overall-pct">{rowPct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="rubric-footer-row">
              <td className="rubric-cell-criterion-total">
                <div className="rubric-footer-label">
                  <strong>Total Section Marks</strong>
                </div>
              </td>
              {parts.map((p) => {
                const colTotal = colTotals[p] || { awarded: 0, max: 0 };
                const pct = colTotal.max > 0 ? (colTotal.awarded / colTotal.max) * 100 : 0;
                const status: AnalysisBandStatus = pct >= 75 ? "strong" : pct >= 50 ? "steady" : "priority";
                return (
                  <td key={p} className="rubric-cell-part-total">
                    <div className={`rubric-part-total-badge is-${status}`}>
                      <span className="rubric-part-total-num">
                        {colTotal.awarded} / {colTotal.max}
                      </span>
                      <span className="rubric-part-total-pct">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                );
              })}
              <td className="rubric-cell-grand-total">
                <div className="rubric-grand-total-card">
                  <span className="rubric-grand-total-num">
                    {grandAwarded} / {grandMax}
                  </span>
                  <span className="rubric-grand-total-pct">
                    {grandMax > 0 ? ((grandAwarded / grandMax) * 100).toFixed(0) : 0}% Grand Total
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Floating Hover Tooltip Anchored to Score Cell */}
      {hoveredCell && typeof document !== "undefined" && createPortal(
        <div
          className={`rubric-hover-tooltip is-${hoveredCell.item.status} ${isAbove ? "is-above" : "is-below"}`}
          style={{
            position: "fixed",
            top: isAbove ? `${hoveredCell.rect.top - 10}px` : `${hoveredCell.rect.bottom + 10}px`,
            left: `${Math.max(180, Math.min(window.innerWidth - 180, hoveredCell.rect.left + hoveredCell.rect.width / 2))}px`,
            transform: isAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            zIndex: 9999999,
          }}
        >
          <div className="rubric-tooltip-accent-line" />
          <div className="rubric-tooltip-content">
            <div className="rubric-tooltip-head">
              <span className="rubric-tooltip-tag">{hoveredCell.item.part_label}</span>
              <strong className="rubric-tooltip-criterion">{hoveredCell.item.criterion}</strong>
              <span className={`rubric-tooltip-score is-${hoveredCell.item.status}`}>
                Score: {hoveredCell.item.marks} ({trim(hoveredCell.item.percentage)}%)
              </span>
            </div>
            {hoveredCell.item.rationale && hoveredCell.item.recommendation && hoveredCell.item.rationale !== hoveredCell.item.recommendation ? (
              <div className="rubric-tooltip-body-stacked">
                <div className="rubric-tooltip-body">
                  <div className="rubric-tooltip-quote-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                  </div>
                  <div className="rubric-tooltip-text-wrap">
                    <span className="rubric-tooltip-section-badge">Examiner Observation</span>
                    <p className="rubric-tooltip-text">{hoveredCell.item.rationale}</p>
                  </div>
                </div>
                <div className="rubric-tooltip-body is-recommendation">
                  <div className="rubric-tooltip-rec-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div className="rubric-tooltip-text-wrap">
                    <span className="rubric-tooltip-section-badge is-rec">Actionable Recommendation</span>
                    <p className="rubric-tooltip-text">{hoveredCell.item.recommendation}</p>
                  </div>
                </div>
              </div>
            ) : hoveredCell.item.action ? (
              <div className="rubric-tooltip-body">
                <div className="rubric-tooltip-quote-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>
                <p className="rubric-tooltip-text">{hoveredCell.item.action}</p>
              </div>
            ) : (
              <div className="rubric-tooltip-body">
                <p className="rubric-tooltip-text is-neutral">Awarded full marks for this criterion.</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
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

  useEffect(() => {
    if (!selectedSkill) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedSkill(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedSkill]);

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

        const isSubjective = !part.auto_marked || skillKey === "writing" || skillKey === "speaking";

        if (isSubjective && part.marks) {
          const parsed = parseMarks(part.marks);
          if (parsed.isPending) {
            isPending = true;
          } else {
            totalAwarded += parsed.awarded;
            totalMax += parsed.max;
          }
        } else if (part.total > 0) {
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

  const singleModule = aggregatedSkills.length === 1 ? aggregatedSkills[0] : null;

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
            <p>
              {singleModule
                ? t.partBreakdown.subheading
                : `${t.partBreakdown.subheading} Click any skill for a detailed part-by-part breakdown.`}
            </p>
          </div>
          <div className="analysis-score-dials-grid is-individual">
            {singleModule
              ? singleModule.subParts.map((part: any, idx: number) => (
                  <ScoreDial
                    key={part.part_code || part.label}
                    label={part.label}
                    stepIndex={idx + 1}
                    marks={part.marks || (part.total > 0 ? `${part.correct} / ${part.total}` : null)}
                    percentage={part.percentage}
                    status={part.status}
                    isLarge={true}
                    note={
                      part.status === "pending"
                        ? t.partBreakdown.awaitingExaminer
                        : part.unanswered
                          ? t.partBreakdown.unansweredSuffix(part.unanswered)
                          : undefined
                    }
                  />
                ))
              : aggregatedSkills.map((skill, idx) => (
                  <ScoreDial
                    key={skill.skill}
                    label={skill.label}
                    stepIndex={idx + 1}
                    marks={skill.marks}
                    percentage={skill.percentage}
                    status={skill.status}
                    isLarge={true}
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
            <p>{t.criteria.subheading} Click any cell to view detailed examiner feedback and recommendations.</p>
          </div>
          <RubricMatrixTable criteria={criteria} />
        </section>
      )}

      {selectedSkill &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="score-details-modal-overlay" onClick={() => setSelectedSkill(null)}>
            <div className="score-details-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="score-details-modal-header">
                <h3>{selectedSkill.label} Breakdown</h3>
                <IconButton
                  className="score-details-modal-close-btn"
                  onClick={() => setSelectedSkill(null)}
                  label="Close"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  }
                />
              </div>
              <div className="score-details-modal-body">
                <p className="score-details-modal-subheading">
                  Every part of the {selectedSkill.label} section, what it tests, and what you scored.
                </p>
                <div className="analysis-score-dials-grid is-individual">
                  {selectedSkill.subParts.map((part: any, idx: number) => (
                    <ScoreDial
                      key={part.part_code || part.label}
                      label={part.label}
                      stepIndex={idx + 1}
                      marks={part.marks}
                      percentage={part.percentage}
                      status={part.status}
                      isLarge={true}
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
          </div>,
          document.body
        )}
    </>
  );
}
