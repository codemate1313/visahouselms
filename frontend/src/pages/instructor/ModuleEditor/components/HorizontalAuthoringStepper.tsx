import { Icon } from "@/components/icons";

interface HorizontalAuthoringStepperProps {
  activeTab: "config" | "instructions";
  onTabChange: (tab: "config" | "instructions") => void;
  hasTitle?: boolean;
}

export function HorizontalAuthoringStepper({
  activeTab,
  onTabChange,
  hasTitle = true,
}: HorizontalAuthoringStepperProps) {
  const isConfigCompleted = hasTitle;

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
              <span className="vh-step-num">1</span>
            )}
          </div>
          <div className="vh-step-content">
            <span className="vh-step-title">1. Test Configuration</span>
            <span className="vh-step-subtitle">Title, duration & details</span>
          </div>
        </button>

        {/* Connecting Progress Line */}
        <div className={`vh-stepper-progress-line ${activeTab === "instructions" ? "is-active" : ""}`}>
          <div className="vh-stepper-progress-fill" />
        </div>

        {/* Step 2: Instructions & Notes */}
        <button
          type="button"
          className={`vh-stepper-step ${activeTab === "instructions" ? "is-active" : ""}`}
          onClick={() => onTabChange("instructions")}
          aria-label="Step 2: Instructions & Notes"
        >
          <div className="vh-step-icon-badge">
            <span className="vh-step-num">2</span>
          </div>
          <div className="vh-step-content">
            <span className="vh-step-title">2. Instructions & Notes</span>
            <span className="vh-step-subtitle">Candidate instructions & guidelines</span>
          </div>
        </button>
      </div>
    </div>
  );
}
