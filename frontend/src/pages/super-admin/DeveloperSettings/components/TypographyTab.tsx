import type { CSSProperties } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
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
  const percent = ((Number(value) - min) / (max - min)) * 100;

  return (
    <div className="typography-slider-row">
      <div className="typography-slider-header">
        <div>
          <label>{label}</label>
          <p>{helper}</p>
        </div>
        <output aria-live="polite">{weightLabel(value)}</output>
      </div>
      <div className="typography-range-wrap">
        <input
          aria-label={label}
          className="typography-range"
          type="range"
          min={min}
          max={max}
          step={10}
          value={value}
          style={{ "--range-progress": `${percent}%` } as CSSProperties}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="typography-range-ticks" aria-hidden="true">
          {scaleValues(min, max).map((tick) => (
            <span key={tick} />
          ))}
        </div>
      </div>
      <div className="typography-range-scale">
        {scaleValues(min, max).map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
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
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>{t.fontFamilyLabel}</label>
        <SearchableSelect
          options={FONT_FAMILY_OPTIONS}
          value={config.fontFamily}
          onChange={(value) => updateConfig({ fontFamily: String(value) })}
          searchPlaceholder={t.fontFamilySearchPlaceholder}
          className="form-dropdown-select typography-font-select"
        />
      </div>

      <div className="typography-slider-panel">
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
        <WeightSlider
          label={t.sliders.body.label}
          helper={t.sliders.body.helper}
          value={config.bodyWeight}
          min={300}
          max={500}
          onChange={(bodyWeight) => updateConfig({ bodyWeight })}
        />
      </div>

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

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={resetConfig}>
          {t.resetLabel}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
