import type { AttemptPart } from "@/api/types";
import { Button, SearchableSelect } from "@/components/ui";
import { gradingDetailStrings as strings } from "../GradingDetail.strings";

function levelForMarks(value: string, maximum: number) {
  const t = strings.levels;
  if (value === "" || maximum <= 0) return t.notScored;
  const percentage = (Number(value) / maximum) * 100;
  if (percentage >= 90) return t.c2;
  if (percentage >= 75) return t.c1;
  if (percentage >= 60) return t.b2;
  if (percentage >= 40) return t.b1;
  return t.belowB1;
}

interface FloatingRubricPanelProps {
  /** The part whose rubric and scoring are visible. */
  part: AttemptPart | null;
  marks: Record<string, string>;
  onMarksChange: (criterion: string, value: string) => void;
  canEdit: boolean;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  saving: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  saveLabel: string;
  /** Position label like "1 / 3", plus prev/next drivers. */
  positionLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * One page-level rubric panel that floats on the right and always shows the
 * scoring inputs for whichever part card the instructor is looking at. Detaches
 * the rubric from the individual cards so it never scrolls out of reach, and
 * ensures only one copy of the CEFR criteria ever exists on screen.
 */
export function FloatingRubricPanel({
  part,
  marks,
  onMarksChange,
  canEdit,
  isOpen,
  onToggleOpen,
  saving,
  onSave,
  saveDisabled,
  saveLabel,
  positionLabel,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: FloatingRubricPanelProps) {
  const t = strings.part;
  if (!part) return null;

  // Panel itself is always visible (docked in the right column). isOpen only
  // controls the grading schema body, so the instructor can open it when they
  // want to score and close it when they just want header + Save + nav.
  return (
    <aside className={`rubric-floater${isOpen ? "" : " is-collapsed"}`} aria-label={t.rubricSticky.title}>
      <div className="rubric-floater-head">
        <div>
          <span className="page-eyebrow">{part.title} · {positionLabel}</span>
          <strong>{t.rubricSticky.title}</strong>
          <small>{t.rubricSummary(part.rubric.length)}</small>
        </div>
        <button
          type="button"
          className="rubric-floater-close"
          onClick={() => onToggleOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? t.rubricSticky.close : t.rubricSticky.show}
        >
          {isOpen ? "×" : "▾"}
        </button>
      </div>

      {isOpen && (
      <div className="rubric-floater-body">
        <div className="cefr-anchor-scale" aria-label={t.cefrAnchorAriaLabel}>
          {part.cefr_scale.map((anchor) => (
            <div key={anchor.level}>
              <strong>{anchor.level}</strong>
              <span>{anchor.marks}</span>
              <p>{anchor.descriptor}</p>
            </div>
          ))}
        </div>

        <div className="rubric-grid">
          {part.rubric.map((criterion) => (
            <article key={criterion.criterion}>
              <div>
                <strong>{criterion.criterion}</strong>
                <span className="cefr-mark-level">{levelForMarks(marks[criterion.criterion] ?? "", criterion.max_marks)}</span>
              </div>
              <p>{criterion.description}</p>
              <label htmlFor={`float-crit-${part.id}-${criterion.criterion}`}>{t.markLabel(criterion.max_marks)}</label>
              <div className="sleek-score-combo">
                <input
                  id={`float-crit-${part.id}-${criterion.criterion}`}
                  type="number"
                  min={0}
                  max={criterion.max_marks}
                  step={0.5}
                  className="sleek-score-input"
                  placeholder="0.0"
                  value={marks[criterion.criterion] ?? ""}
                  disabled={!canEdit}
                  onChange={(event) => onMarksChange(criterion.criterion, event.target.value)}
                />
                <SearchableSelect
                  ariaLabel={t.markLabel(criterion.max_marks)}
                  className="sleek-score-select"
                  options={[
                    { value: "", label: "Select preset score..." },
                    ...Array.from({ length: Math.floor(criterion.max_marks * 2) + 1 }, (_, i) => {
                      const scoreVal = i * 0.5;
                      return { value: String(scoreVal), label: `${scoreVal} / ${criterion.max_marks} marks` };
                    }),
                  ]}
                  searchable={false}
                  value={marks[criterion.criterion] ?? ""}
                  disabled={!canEdit}
                  onChange={(value) => onMarksChange(criterion.criterion, String(value))}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
      )}

      {!isOpen && (
        <button
          type="button"
          className="rubric-floater-expand"
          onClick={() => onToggleOpen(true)}
        >
          {t.rubricSticky.show}
        </button>
      )}

      <div className="rubric-floater-foot">
        {canEdit && (
          <Button onClick={onSave} disabled={saveDisabled || saving} fullWidth>
            {saving ? t.saving : saveLabel}
          </Button>
        )}
        <div className="rubric-floater-nav">
          <Button variant="secondary" size="sm" disabled={!canPrev} onClick={onPrev}>
            {t.rubricNav.prev}
          </Button>
          <span className="rubric-floater-position" aria-live="polite">{positionLabel}</span>
          <Button variant="secondary" size="sm" disabled={!canNext} onClick={onNext}>
            {t.rubricNav.next}
          </Button>
        </div>
      </div>
    </aside>
  );
}
