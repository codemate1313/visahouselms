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
  /** Controls only the CEFR anchor descriptor block. The rest of the panel
   *  is always visible so the instructor can score. */
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  saving: boolean;
  autosaveStatus: string;
  positionLabel: string;
  canPrev: boolean;
  canNext: boolean;
  nextDisabled: boolean;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Docked rubric panel: header, per-criterion scoring inputs, Save and Prev/Next
 * are always visible. Only the CEFR anchor reference block is collapsible - the
 * instructor opens it when they want to remind themselves what each band means.
 */
export function FloatingRubricPanel({
  part,
  marks,
  onMarksChange,
  canEdit,
  isOpen,
  onToggleOpen,
  saving,
  autosaveStatus,
  positionLabel,
  canPrev,
  canNext,
  nextDisabled,
  nextLabel,
  onPrev,
  onNext,
}: FloatingRubricPanelProps) {
  const t = strings.part;
  if (!part) return null;

  return (
    <aside className="rubric-floater" aria-label={t.rubricSticky.title}>
      <div className="rubric-floater-head">
        <div>
          <span className="page-eyebrow">{part.title} · {positionLabel}</span>
          <strong>{t.rubricSticky.title}</strong>
          <small>{t.rubricSummary(part.rubric.length)}</small>
        </div>
      </div>

      <div className="rubric-floater-body">
        {/* CEFR anchor descriptors are reference material - collapsed by
            default so they do not dominate the panel. */}
        <button
          type="button"
          className="rubric-anchor-toggle"
          onClick={() => onToggleOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span>{t.rubricAnchorToggle.title}</span>
          <span className="rubric-anchor-toggle-chevron">{isOpen ? "▴" : "▾"}</span>
        </button>
        {isOpen && (
          <div className="cefr-anchor-scale" aria-label={t.cefrAnchorAriaLabel}>
            {part.cefr_scale.map((anchor) => (
              <div key={anchor.level}>
                <strong>{anchor.level}</strong>
                <span>{anchor.marks}</span>
                <p>{anchor.descriptor}</p>
              </div>
            ))}
          </div>
        )}

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
                  type="text"
                  inputMode="decimal"
                  className="sleek-score-input"
                  placeholder="0.0"
                  value={marks[criterion.criterion] ?? ""}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const val = event.target.value.replace(/,/g, '.');
                    if (/^\d*\.?\d*$/.test(val)) {
                      onMarksChange(criterion.criterion, val);
                    }
                  }}
                  onBlur={(event) => {
                    const val = event.target.value;
                    if (val) {
                      const num = parseFloat(val);
                      if (!isNaN(num)) {
                        const clamped = Math.min(Math.max(num, 0), criterion.max_marks);
                        if (clamped.toString() !== val) {
                          onMarksChange(criterion.criterion, clamped.toString());
                        }
                      } else {
                        onMarksChange(criterion.criterion, "");
                      }
                    }
                  }}
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

      <div className="rubric-floater-foot">
        {canEdit && <span className="rubric-autosave-status" aria-live="polite">{saving ? t.saving : autosaveStatus}</span>}
        <div className="rubric-floater-nav">
          <Button variant="secondary" size="sm" disabled={!canPrev} onClick={onPrev}>
            {t.rubricNav.prev}
          </Button>
          <span className="rubric-floater-position" aria-live="polite">{positionLabel}</span>
          <Button variant="secondary" size="sm" disabled={!canNext || nextDisabled || saving} onClick={onNext}>
            {saving ? t.saving : nextLabel}
          </Button>
        </div>
      </div>
    </aside>
  );
}
