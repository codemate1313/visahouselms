import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RangeSlider } from "@/components/ui";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FONT_FAMILY_OPTIONS, useFontStore } from "@/store/fontStore";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

function weightTone(weight: string) {
  if (weight === "600") return "Sleek";
  if (weight === "400") return "Regular";
  if (Number(weight) >= 700) return "Bold";
  if (Number(weight) <= 300) return "Light";
  return "Balanced";
}

function weightLabel(weight: string) {
  return `${weight} ${weightTone(weight)}`;
}

function scaleValues(min: number, max: number) {
  return Array.from({ length: 11 }, (_, index) => Math.round(min + ((max - min) / 10) * index));
}

interface WeightSliderProps {
  label: string;
  helper: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}

function WeightSlider({ label, helper, value, min, max, onChange }: WeightSliderProps) {
  return (
    <div className="typography-slider-row">
      <div className="typography-slider-header">
        <div>
          <label>{label}</label>
          <p>{helper}</p>
        </div>
        <output aria-live="polite">{weightLabel(value)}</output>
      </div>
      <RangeSlider
        ariaLabel={label}
        value={Number(value)}
        min={min}
        max={max}
        step={10}
        scale={scaleValues(min, max)}
        onChange={(next) => onChange(String(next))}
      />
      <p className="typography-selected-value">
        Selecting <strong>{value}</strong> for {label.toLowerCase()}.
      </p>
    </div>
  );
}

export function TypographyTab() {
  const { config, updateConfig, resetConfig } = useFontStore();
  const t = strings.typography;

  return (
    <CollapsiblePanel className="form-card wide developer-panel-card typography-panel-card" title={t.title} description={t.description}>
      <div className="typography-two-col-grid">
        {/* Left Column: Font Family + Headings & Stat Weight Sliders */}
        <div className="typography-col-left">
          <div className="typography-font-select-wrap">
            <label style={{ fontWeight: 700, display: "block", marginBottom: 6, fontSize: 13 }}>
              {t.fontFamilyLabel}
            </label>
            <SearchableSelect
              options={FONT_FAMILY_OPTIONS}
              value={config.fontFamily}
              onChange={(value) => updateConfig({ fontFamily: String(value) })}
              searchPlaceholder={t.fontFamilySearchPlaceholder}
              className="form-dropdown-select typography-font-select"
            />
          </div>

          <WeightSlider
            label={t.sliders.headings.label}
            helper={t.sliders.headings.helper}
            value={config.headingWeight}
            min={400}
            max={800}
            onChange={(headingWeight) => updateConfig({ headingWeight })}
          />

          <WeightSlider
            label={t.sliders.stat.label}
            helper={t.sliders.stat.helper}
            value={config.statWeight}
            min={500}
            max={800}
            onChange={(statWeight) => updateConfig({ statWeight })}
          />
        </div>

        {/* Right Column: Body Weight Slider + Real-Time Preview */}
        <div className="typography-col-right">
          <WeightSlider
            label={t.sliders.body.label}
            helper={t.sliders.body.helper}
            value={config.bodyWeight}
            min={300}
            max={500}
            onChange={(bodyWeight) => updateConfig({ bodyWeight })}
          />

          <div className="typography-preview">
            <div className="typography-preview-copy">
              <span>{t.preview.eyebrow}</span>
              <h2>{t.preview.heading}</h2>
              <p>{t.preview.subtitle}</p>
            </div>
            <div className="typography-preview-metrics">
              <div className="typography-preview-stat">
                <p>{t.preview.revenue}</p>
                <strong>₹6,599</strong>
              </div>
              <div className="typography-preview-stat">
                <p>{t.preview.institutes}</p>
                <strong>24</strong>
              </div>
              <div className="typography-preview-stat">
                <p>{t.preview.due}</p>
                <strong>₹840</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button type="button" className="button secondary" onClick={resetConfig}>
          {t.resetLabel}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
