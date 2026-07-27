import { ToggleSwitch } from "@/components/ToggleSwitch";
import { directStudentCatalogue as catalogue, plansStrings as strings } from "../Plans.strings";

interface PlanVisibilityBarProps {
  visible: boolean;
  /** False until the stored flag arrives, so the switch never flashes a state
   *  the Super Admin did not set. */
  loaded: boolean;
  onChange: (visible: boolean) => void;
  saving: boolean;
}

export function PlanVisibilityBar({ visible, loaded, onChange, saving }: PlanVisibilityBarProps) {
  return (
    <div className="plan-audience-bar">
      <div className="plan-visibility-control">
        <div className="plan-visibility-copy">
          <span className="plan-visibility-label">{strings.visibility.label}</span>
          <span className="plan-visibility-hint">
            {!loaded ? strings.loading : visible ? catalogue.visibilityHint : catalogue.hiddenHint}
          </span>
        </div>
        <ToggleSwitch
          checked={visible}
          onChange={() => onChange(!visible)}
          disabled={saving || !loaded}
          tooltip={strings.visibility.tooltip}
        />
      </div>
    </div>
  );
}
