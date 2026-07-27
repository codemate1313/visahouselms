import { ToggleSwitch } from "@/components/ToggleSwitch";
import { planAudienceOrder, planCatalogues, plansStrings as strings, type PlanAudience } from "../Plans.strings";

interface PlanAudienceBarProps {
  audience: PlanAudience;
  onAudienceChange: (audience: PlanAudience) => void;
  /** Per-catalogue "list this on the public pricing page" flags; null until loaded. */
  visibility: Record<PlanAudience, boolean> | null;
  onVisibilityChange: (audience: PlanAudience, visible: boolean) => void;
  visibilitySaving: boolean;
}

export function PlanAudienceBar({ audience, onAudienceChange, visibility, onVisibilityChange, visibilitySaving }: PlanAudienceBarProps) {
  const activeIndex = planAudienceOrder.indexOf(audience);
  const visible = Boolean(visibility?.[audience]);
  const bothHidden = Boolean(visibility) && planAudienceOrder.every((key) => !visibility?.[key]);

  return (
    <div className="plan-audience-bar">
      <div className="apple-segmented-control plan-audience-tabs">
        <div
          className="apple-segmented-thumb"
          style={{
            width: `calc((100% - 4px) / ${planAudienceOrder.length})`,
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
        />
        {planAudienceOrder.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onAudienceChange(key)}
            className={`apple-segmented-tab ${audience === key ? "is-active" : ""}`}
          >
            {planCatalogues[key].tab}
          </button>
        ))}
      </div>

      <div className="plan-visibility-control">
        <div className="plan-visibility-copy">
          <span className="plan-visibility-label">{strings.visibility.label}</span>
          <span className="plan-visibility-hint">
            {visibility === null
              ? strings.loading
              : visible ? planCatalogues[audience].visibilityHint : planCatalogues[audience].hiddenHint}
          </span>
          {bothHidden && <span className="plan-visibility-note">{strings.visibility.bothHiddenNote}</span>}
        </div>
        <ToggleSwitch
          checked={visible}
          onChange={() => onVisibilityChange(audience, !visible)}
          disabled={visibilitySaving || visibility === null}
          tooltip={strings.visibility.tooltip}
        />
      </div>
    </div>
  );
}
