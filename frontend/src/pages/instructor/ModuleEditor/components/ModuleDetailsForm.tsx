import { type FormEvent, useState } from "react";
import { RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";
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
  existingTitles?: string[];
}

export function ModuleDetailsForm({
  module,
  details,
  onDetailsChange,
  isEditable,
  busy,
  onSubmit,
  existingTitles,
}: ModuleDetailsFormProps) {
  const t = strings.newModule; // Reusing strings from new module where appropriate
  const typeLabels = strings.typeLabels;
  const [activeTab, setActiveTab] = useState<"config" | "instructions">("config");

  const requestedType = module.module_type;
  const durationIsCalculated = DERIVED_DURATION_MODULE_TYPES.has(requestedType);
  const typeLabel = typeLabels[requestedType];
  const meta = MODULE_TYPE_META[requestedType];

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateTitle = (): string | null => {
    const trimmed = details.title.trim();
    if (!trimmed) {
      return "Module Title is required before proceeding to Step 2.";
    }
    const isDuplicate = existingTitles?.some(
      (t) => t.trim().toLowerCase() === trimmed.toLowerCase() && t.trim().toLowerCase() !== module.title.trim().toLowerCase()
    );
    if (isDuplicate) {
      return "Test with same name already exists, you can't create one.";
    }
    return null;
  };

  const handleNextStep = () => {
    const titleError = validateTitle();
    if (titleError) {
      setValidationError(titleError);
      document.getElementById("edit-module-title")?.focus();
      return;
    }
    setValidationError(null);
    setActiveTab("instructions");
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const handleSubmit = (event: FormEvent) => {
    const titleError = validateTitle();
    if (titleError) {
      event.preventDefault();
      setActiveTab("config");
      setValidationError(titleError);
      document.getElementById("edit-module-title")?.focus();
      return;
    }
    if (activeTab === "config") {
      event.preventDefault();
      handleNextStep();
    } else {
      onSubmit(event);
    }
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
          if (tab === "instructions") {
            const titleError = validateTitle();
            if (titleError) {
              setValidationError(titleError);
              document.getElementById("edit-module-title")?.focus();
              return;
            }
          }
          setValidationError(null);
          setActiveTab(tab);
        }}
        hasTitle={!validateTitle()}
        hasInstructions={(details.show_onboarding_instructions ?? true) ? (details.onboarding_instructions && details.onboarding_instructions.length > 0) : true}
      />

      {/* 2. Interactive Studio Grid */}
      <form onSubmit={handleSubmit} className="vh-studio-grid">
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
                    className={`vh-input-enhanced ${validationError ? "is-invalid" : ""}`}
                    value={details.title}
                    onChange={(event) => {
                      const val = event.target.value;
                      onDetailsChange({ ...details, title: val });
                      if (validationError) {
                        const trimmed = val.trim().toLowerCase();
                        const isDup = existingTitles?.some(
                          (t) => t.trim().toLowerCase() === trimmed && t.trim().toLowerCase() !== module.title.trim().toLowerCase()
                        );
                        if (!val.trim()) {
                          setValidationError("Module Title is required before proceeding to Step 2.");
                        } else if (isDup) {
                          setValidationError("Test with same name already exists, you can't create one.");
                        } else {
                          setValidationError(null);
                        }
                      }
                    }}
                    onBlur={() => {
                      const titleError = validateTitle();
                      if (titleError && details.title.trim()) {
                        setValidationError(titleError);
                      }
                    }}
                    placeholder={t.titlePlaceholder(typeLabel)}
                    maxLength={200}
                    required
                    readOnly={!isEditable}
                  />
                  {details.title && isEditable && (
                    <IconButton
                      icon={<Icon name="cross" />}
                      label="Clear title"
                      showTooltip={false}
                      className="vh-clear-btn"
                      onClick={() => {
                        onDetailsChange({ ...details, title: "" });
                        setValidationError(null);
                      }}
                    />
                  )}
                </div>

                {validationError && (
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
                    <IconButton
                      icon={<Icon name="minus" />}
                      label="Subtract 5 minutes"
                      className="vh-step-btn"
                      onClick={() => adjustDuration(-5)}
                      disabled={!isEditable || durationIsCalculated}
                    />
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
                    <IconButton
                      icon={<Icon name="plus" />}
                      label="Add 5 minutes"
                      className="vh-step-btn"
                      onClick={() => adjustDuration(5)}
                      disabled={!isEditable || durationIsCalculated}
                    />
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
            <OnboardingInstructionsEditor
              showInstructions={details.show_onboarding_instructions ?? true}
              onToggleShowInstructions={(enabled) => onDetailsChange({ ...details, show_onboarding_instructions: enabled })}
              instructions={details.onboarding_instructions ?? []}
              onInstructionsChange={(items) => onDetailsChange({ ...details, onboarding_instructions: items })}
              isEditable={isEditable}
            />
          )}

          {/* Bottom Action Bar inside Main Form Column */}
          {activeTab === "config" ? (
            <div className="vh-main-col-actions is-end">
              <Button
                type="button"
                className="vh-btn-primary-brand"
                onClick={handleNextStep}
              >
                <span>Next: Instructions & Notes</span>
                <Icon name="arrowRight" />
              </Button>
            </div>
          ) : (
            <div className="vh-main-col-actions is-between">
              <Button
                type="button"
                variant="secondary"
                className="button secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                onClick={() => {
                  setActiveTab("config");
                  window.scrollTo({ top: 120, behavior: "smooth" });
                }}
              >
                <Icon name="arrowLeft" />
                <span>Back to Step 1: Configuration</span>
              </Button>

              {isEditable && (
                <Button
                  type="submit"
                  className="vh-btn-primary-brand"
                  disabled={busy || !details.title.trim()}
                >
                  <span>{busy ? "Saving..." : "Save Details"}</span>
                  <Icon name="arrowRight" />
                </Button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
