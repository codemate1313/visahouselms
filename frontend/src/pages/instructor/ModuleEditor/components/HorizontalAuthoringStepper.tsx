import { Icon } from "@/components/icons";

interface HorizontalAuthoringStepperProps {
  activeTab: "config" | "instructions";
  onTabChange: (tab: "config" | "instructions") => void;
  hasTitle?: boolean;
  hasInstructions?: boolean;
}

export function HorizontalAuthoringStepper({
  activeTab,
  onTabChange,
  hasTitle = true,
  hasInstructions = false,
}: HorizontalAuthoringStepperProps) {
  const isConfigCompleted = hasTitle;
  const isInstructionsCompleted = hasInstructions;

  return (
    <div className="vh-horizontal-stepper-card">
      <div className="vh-stepper-inner-container">
        {/* Step 1: Test Configuration */}
        <button
          type="button"
          className={`vh-stepper-step ${activeTab === "config" ? "is-active" : isConfigCompleted ? "is-completed" : ""}`}
          onClick={() => onTabChange("config")}
          aria-label="Step 1: Test Configuration"
        >
          <div className="vh-step-icon-badge">
            {isConfigCompleted && activeTab !== "config" ? (
              <Icon name="check" className="vh-step-check-icon" />
            ) : (
              <Icon name="settings" className="vh-step-icon" />
            )}
          </div>
          <span className="vh-step-title">Test Configuration</span>
        </button>

        {/* Step 2: Instructions & Notes */}
        <button
          type="button"
          className={`vh-stepper-step ${activeTab === "instructions" ? "is-active" : isInstructionsCompleted ? "is-completed" : ""}`}
          onClick={() => onTabChange("instructions")}
          aria-label="Step 2: Instructions & Notes"
        >
          <div className="vh-step-icon-badge">
            {isInstructionsCompleted && activeTab !== "instructions" ? (
              <Icon name="check" className="vh-step-check-icon" />
            ) : (
              <Icon name="logs" className="vh-step-icon" />
            )}
          </div>
          <span className="vh-step-title">Instructions & Notes</span>
        </button>
      </div>
    </div>
  );
}
