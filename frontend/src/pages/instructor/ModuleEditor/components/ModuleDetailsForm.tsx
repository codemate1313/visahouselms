import { type FormEvent, useState } from "react";
import { RequiredMark } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExamModule, OnboardingInstruction } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { DERIVED_DURATION_MODULE_TYPES, MODULE_TYPE_META } from "../helpers";
import { OnboardingInstructionsEditor } from "./OnboardingInstructionsEditor";
import { HorizontalAuthoringStepper } from "./HorizontalAuthoringStepper";

export interface ModuleDetailsState {
  title: string;
  description: string;
  instructions: string;
  duration_minutes: number;
  show_onboarding_instructions?: boolean;
  onboarding_instructions?: OnboardingInstruction[];
}

interface ModuleDetailsFormProps {
  module: ExamModule;
  details: ModuleDetailsState;
  onDetailsChange: (details: ModuleDetailsState) => void;
  isEditable: boolean;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onDelete: () => void;
}

export function ModuleDetailsForm({
  module,
  details,
  onDetailsChange,
  isEditable,
  busy,
  onSubmit,
}: ModuleDetailsFormProps) {
  const t = strings.newModule; // Reusing strings from new module where appropriate
  const typeLabels = strings.typeLabels;
  const [activeTab, setActiveTab] = useState<"config" | "instructions">("config");

  const requestedType = module.module_type;
  const durationIsCalculated = DERIVED_DURATION_MODULE_TYPES.has(requestedType);
  const typeLabel = typeLabels[requestedType];
  const meta = MODULE_TYPE_META[requestedType];

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleNextStep = () => {
    if (!details.title.trim()) {
      setValidationError("Module Title is required before proceeding to Step 2.");
      document.getElementById("edit-module-title")?.focus();
      return;
    }
    setValidationError(null);
    setActiveTab("instructions");
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const adjustDuration = (delta: number) => {
    if (!isEditable) return;
    const next = Math.max(1, Math.min(600, (details.duration_minutes || meta.defaultDuration) + delta));
    onDetailsChange({ ...details, duration_minutes: next });
  };

  const setDurationPreset = (val: number) => {
    if (!isEditable) return;
    onDetailsChange({ ...details, duration_minutes: val });
  };

  return (
    <div className="new-module-studio-container" style={{ margin: 0, width: "100%" }}>
      {/* 1. Top Horizontal Authoring Stepper Bar */}
      <HorizontalAuthoringStepper
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "instructions" && !details.title.trim()) {
            setValidationError("Module Title is required before proceeding to Step 2.");
            document.getElementById("edit-module-title")?.focus();
            return;
          }
          setValidationError(null);
          setActiveTab(tab);
        }}
        hasTitle={!!details.title.trim()}
      />

      {/* 2. Interactive Studio Grid */}
      <form onSubmit={onSubmit} className="vh-studio-grid">
        {/* Left Column: Form Controls */}
        <div className="vh-studio-main-col">
          {activeTab === "config" ? (
            <div className="vh-studio-card">
              <div className="vh-card-header">
                <h2>Module Basic Details</h2>
                <p>Define the title, duration, and summary of this assessment.</p>
              </div>

              {/* Title Field */}
              <div className="vh-form-group">
                <div className="vh-label-row">
                  <label htmlFor="edit-module-title">
                    Module Title <RequiredMark />
                  </label>
                  <span className="vh-char-counter">{details.title.length} / 200</span>
                </div>

                <div className="vh-input-wrapper">
                  <input
                    id="edit-module-title"
                    className={`vh-input-enhanced ${validationError && !details.title.trim() ? "is-invalid" : ""}`}
                    value={details.title}
                    onChange={(event) => {
                      setValidationError(null);
                      onDetailsChange({ ...details, title: event.target.value });
                    }}
                    placeholder={t.titlePlaceholder(typeLabel)}
                    maxLength={200}
                    required
                    readOnly={!isEditable}
                  />
                  {details.title && isEditable && (
                    <button
                      type="button"
                      className="vh-clear-btn"
                      onClick={() => onDetailsChange({ ...details, title: "" })}
                      title="Clear title"
                    >
                      <Icon name="cross" />
                    </button>
                  )}
                </div>

                {validationError && !details.title.trim() && (
                  <p className="vh-validation-inline-error">
                    <Icon name="cross" />
                    <span>{validationError}</span>
                  </p>
                )}
              </div>

              {/* Interactive Duration Stepper & Presets */}
              <div className="vh-form-group">
                <div className="vh-label-row">
                  <label htmlFor="edit-module-duration">
                    {durationIsCalculated ? t.calculatedDurationLabel : "Exam Duration (Minutes)"} <RequiredMark />
                  </label>
                </div>

                <div className="vh-duration-stepper-row">
                  <div className="vh-stepper-control">
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(-5)} disabled={!isEditable || durationIsCalculated} title="Subtract 5 minutes">
                      <Icon name="minus" />
                    </button>
                    <div className="vh-duration-val-box">
                      <input
                        id="edit-module-duration"
                        type="number"
                        className="vh-duration-input"
                        min={1}
                        max={600}
                        value={details.duration_minutes || meta.defaultDuration}
                        onChange={(event) => onDetailsChange({ ...details, duration_minutes: Number(event.target.value) })}
                        required
                        readOnly={!isEditable || durationIsCalculated}
                      />
                      <span className="vh-stepper-unit">mins</span>
                    </div>
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(5)} disabled={!isEditable || durationIsCalculated} title="Add 5 minutes">
                      <Icon name="plus" />
                    </button>
                  </div>

                  {!durationIsCalculated && <div className="vh-duration-preset-pills">
                    {meta.durationPresets.map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={`vh-duration-pill ${(details.duration_minutes || meta.defaultDuration) === val ? "is-active" : ""}`}
                        onClick={() => setDurationPreset(val)}
                        disabled={!isEditable}
                      >
                        {val}m
                      </button>
                    ))}
                  </div>}
                </div>
                {durationIsCalculated && <p className="field-hint">{strings.details.calculatedDurationHint}</p>}
              </div>


            </div>
          ) : (
            <div className="vh-studio-card">
              <div className="vh-card-header">
                <h2>Candidate Instructions</h2>
                <p>Instructions displayed to students on screen before the test begins.</p>
              </div>

              {/* Onboarding Instructions Manager */}
              <OnboardingInstructionsEditor
                showInstructions={details.show_onboarding_instructions ?? true}
                onToggleShowInstructions={(enabled) => onDetailsChange({ ...details, show_onboarding_instructions: enabled })}
                instructions={details.onboarding_instructions ?? []}
                onInstructionsChange={(items) => onDetailsChange({ ...details, onboarding_instructions: items })}
                isEditable={isEditable}
              />
            </div>
          )}

          {/* Bottom Action Bar inside Main Form Column */}
          {activeTab === "config" ? (
            <div className="vh-main-col-actions" style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                type="button"
                className="vh-btn-primary-brand"
                onClick={handleNextStep}
              >
                <span>Next: Instructions & Notes</span>
                <Icon name="arrowRight" />
              </button>
            </div>
          ) : (
            <div className="vh-main-col-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                onClick={() => {
                  setActiveTab("config");
                  window.scrollTo({ top: 120, behavior: "smooth" });
                }}
              >
                <Icon name="arrowLeft" />
                <span>Back to Step 1: Configuration</span>
              </button>

              {isEditable && (
                <button
                  type="submit"
                  className="vh-btn-primary-brand"
                  disabled={busy || !details.title.trim()}
                >
                  <span>{busy ? "Saving..." : "Save Details"}</span>
                  <Icon name="arrowRight" />
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
