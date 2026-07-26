import { planFormStrings as strings } from "../PlanForm.strings";

interface PlanFeatureEditorProps {
  features: string[];
  maxFeatures: number;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Authors the ticked bullet list shown on the public pricing card. */
export function PlanFeatureEditor({ features, maxFeatures, onChange, onAdd, onRemove }: PlanFeatureEditorProps) {
  const t = strings.featureEditor;

  return (
    <fieldset className="plan-course-picker plan-feature-editor">
      <legend>{t.legend}</legend>
      <p className="hint">{t.hint}</p>

      {!features.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        features.map((feature, index) => (
          <div className="plan-feature-row" key={index}>
            <span className="plan-feature-bullet" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <input
              value={feature}
              maxLength={120}
              placeholder={t.placeholder}
              aria-label={t.itemLabel(index + 1)}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <button type="button" className="plan-feature-remove" onClick={() => onRemove(index)} title={t.remove}>
              {t.removeGlyph}
            </button>
          </div>
        ))
      )}

      <button type="button" className="plan-feature-add" onClick={onAdd} disabled={features.length >= maxFeatures}>
        {t.add}
      </button>
    </fieldset>
  );
}
