import { type FormEvent, useState } from "react";
import { RequiredMark } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExamModule, OnboardingInstruction } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { MODULE_TYPE_META } from "../helpers";
import { OnboardingInstructionsEditor } from "./OnboardingInstructionsEditor";

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
  const typeLabel = typeLabels[requestedType];
  const meta = MODULE_TYPE_META[requestedType];

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
    <div className="new-module-studio-container" style={{ margin: 0 }}>
      {/* 1. Header Banner & Actions */}
      <div className="module-editor-breadcrumb-bar" style={{ borderRadius: "12px", borderBottomRightRadius: 0, borderBottomLeftRadius: 0 }}>
        <div className="studio-tab-controls" style={{ marginLeft: 0 }}>
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === "config" ? "is-active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            <Icon name="edit" />
            <span>1. Test Configuration</span>
          </button>
          <button
            type="button"
            className={`studio-tab-btn ${activeTab === "instructions" ? "is-active" : ""}`}
            onClick={() => setActiveTab("instructions")}
          >
            <Icon name="filePdf" />
            <span>2. Instructions & Notes</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive 2-Column Studio Grid */}
      <form onSubmit={onSubmit} className="vh-studio-grid vh-module-details-grid" style={{ paddingTop: "24px" }}>
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
                    className="vh-input-enhanced"
                    value={details.title}
                    onChange={(event) => onDetailsChange({ ...details, title: event.target.value })}
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
              </div>

              {/* Interactive Duration Stepper & Presets */}
              <div className="vh-form-group">
                <div className="vh-label-row">
                  <label htmlFor="edit-module-duration">
                    Exam Duration (Minutes) <RequiredMark />
                  </label>
                </div>

                <div className="vh-duration-stepper-row">
                  <div className="vh-stepper-control">
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(-5)} disabled={!isEditable} title="Subtract 5 minutes">
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
                        readOnly={!isEditable}
                      />
                      <span className="vh-stepper-unit">mins</span>
                    </div>
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(5)} disabled={!isEditable} title="Add 5 minutes">
                      <Icon name="plus" />
                    </button>
                  </div>

                  <div className="vh-duration-preset-pills">
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
                  </div>
                </div>
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
        </div>

        {/* Right Column: Live Interactive Module Card Preview */}
        <div className="vh-studio-side-col">
          <div className="vh-preview-sticky-card">
            <div className="vh-preview-header">
              <span className="vh-live-dot" />
              <h3>Live Assessment Preview</h3>
            </div>

            {/* Simulated Student Module Card */}
            <div className="vh-simulated-module-card">
              <div className="vh-sim-top">
                <span className={`section-chip section-${requestedType}`}>{typeLabel}</span>
                <span className="vh-sim-time">⏱️ {details.duration_minutes || meta.defaultDuration} Mins</span>
              </div>

              <h4 className="vh-sim-title">
                {details.title || <em className="vh-placeholder-text">Module title will appear here...</em>}
              </h4>

              <p className="vh-sim-desc">
                {details.description || "Comprehensive IELTS practice test with automated scoring and section feedback."}
              </p>

              <div className="vh-sim-features">
                {meta.specs.map((item, idx) => (
                  <span key={idx} className="vh-sim-feat-chip">
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Submit Action Box */}
            <div className="vh-submit-box">
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
          </div>
        </div>
      </form>
    </div>
  );
}
