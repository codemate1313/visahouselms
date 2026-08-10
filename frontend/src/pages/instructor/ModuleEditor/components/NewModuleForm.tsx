import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExamModule, ExamModuleType, IeltsSection } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { COMPOSITE_TYPES, SOURCE_SECTIONS, MODULE_TYPE_META } from "../helpers";
import type { ModuleDetailsState } from "./ModuleDetailsForm";
import { OnboardingInstructionsEditor } from "./OnboardingInstructionsEditor";
import { HorizontalAuthoringStepper } from "./HorizontalAuthoringStepper";

interface NewModuleFormProps {
  requestedType: ExamModuleType | null;
  details: ModuleDetailsState;
  onDetailsChange: (details: ModuleDetailsState) => void;
  sourceModules: ExamModule[];
  selectedSources: Record<IeltsSection, string>;
  onSelectedSourcesChange: (sources: Record<IeltsSection, string>) => void;
  loadingSources: boolean;
  busy: boolean;
  error: string | null;
  moduleWorkspacePath: string;
  onSubmit: (event: FormEvent) => void;
}
export function NewModuleForm({
  requestedType,
  details,
  onDetailsChange,
  sourceModules,
  selectedSources,
  onSelectedSourcesChange,
  loadingSources,
  busy,
  error,
  moduleWorkspacePath,
  onSubmit,
}: NewModuleFormProps) {
  const t = strings.newModule;
  const typeLabels = strings.typeLabels;
  const [activeTab, setActiveTab] = useState<"config" | "instructions">("config");

  if (!requestedType) {
    return (
      <div className="empty-state">
        <h1>{strings.unknownType.title}</h1>
        <Link to={moduleWorkspacePath}>{strings.unknownType.backLink}</Link>
      </div>
    );
  }

  const typeLabel = typeLabels[requestedType];
  const meta = MODULE_TYPE_META[requestedType];
  const isComposite = COMPOSITE_TYPES.has(requestedType);
  const allSourcesSelected = SOURCE_SECTIONS.every((section) => selectedSources[section]);

  const adjustDuration = (delta: number) => {
    const next = Math.max(1, Math.min(600, (details.duration_minutes || meta.defaultDuration) + delta));
    onDetailsChange({ ...details, duration_minutes: next });
  };

  const setDurationPreset = (val: number) => {
    onDetailsChange({ ...details, duration_minutes: val });
  };

  return (
    <div className="new-module-studio-container">
      {/* 1. Top Breadcrumb Bar */}
      <div className="module-editor-breadcrumb-bar">
        <div className="module-editor-breadcrumb-left">
          <Link to={moduleWorkspacePath} className="button secondary module-back-btn">
            <Icon name="arrowLeft" />
            All Modules
          </Link>
          <div className="breadcrumb-trail">
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current-title">Create {typeLabel}</span>
          </div>
        </div>
      </div>

      {error && <p className="error-text notice-line">{error}</p>}

      {/* 2. Hero Header Banner in Visa House Crimson Brand Theme */}
      <div className="vh-brand-hero-banner">
        <div className="vh-hero-header-top">
          <div className="vh-hero-title-group">
            <div className="vh-hero-chip-group">
              <span className="vh-chip-white-solid">{typeLabel}</span>
              <span className="vh-chip-outline-glass">{meta.badge}</span>
            </div>
            <h1 className="vh-hero-title">Author New {typeLabel} Test</h1>
            <p className="vh-hero-subtitle">{meta.tagline}</p>
          </div>
          <div className="vh-hero-icon-box">
            <Icon name={meta.icon} />
          </div>
        </div>

        <div className="vh-hero-meta-row">
          <div className="vh-spec-badges">
            {meta.specs.map((spec, idx) => (
              <span key={idx} className="vh-spec-tag">
                <Icon name="check" />
                {spec}
              </span>
            ))}
          </div>
          <div className="vh-duration-quick-badge">
            <Icon name="history" />
            <span>Target Duration: <strong>{details.duration_minutes || meta.defaultDuration} mins</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Authoring Stepper Bar (Positioned below the red hero card) */}
      <HorizontalAuthoringStepper
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasTitle={!!details.title}
      />

      {/* 4. Interactive 2-Column Studio Grid */}
      <form onSubmit={onSubmit} className="vh-studio-grid">
        {/* Main Column: Form Controls with Stage Animation */}
        <div className="vh-studio-main-col stage-fade-in" key={activeTab}>
          {activeTab === "config" ? (
            <div className="vh-studio-card">
              <div className="vh-card-header">
                <h2>Module Basic Details</h2>
                <p>Define the title, duration, and summary of this assessment.</p>
              </div>

              {/* Title Field */}
              <div className="vh-form-group">
                <div className="vh-label-row">
                  <label htmlFor="new-module-title">
                    Module Title <RequiredMark />
                  </label>
                  <span className="vh-char-counter">{details.title.length} / 200</span>
                </div>

                <div className="vh-input-wrapper">
                  <input
                    id="new-module-title"
                    className="vh-input-enhanced"
                    value={details.title}
                    onChange={(event) => onDetailsChange({ ...details, title: event.target.value })}
                    placeholder={t.titlePlaceholder(typeLabel)}
                    maxLength={200}
                    required
                    autoFocus
                  />
                  {details.title && (
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
                  <label htmlFor="new-module-duration">
                    Exam Duration (Minutes) <RequiredMark />
                  </label>
                </div>

                <div className="vh-duration-stepper-row">
                  <div className="vh-stepper-control">
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(-5)} title="Subtract 5 minutes">
                      <Icon name="minus" />
                    </button>
                    <div className="vh-duration-val-box">
                      <input
                        id="new-module-duration"
                        type="number"
                        className="vh-duration-input"
                        min={1}
                        max={600}
                        value={details.duration_minutes || meta.defaultDuration}
                        onChange={(event) => onDetailsChange({ ...details, duration_minutes: Number(event.target.value) })}
                        required
                      />
                      <span className="vh-stepper-unit">mins</span>
                    </div>
                    <button type="button" className="vh-step-btn" onClick={() => adjustDuration(5)} title="Add 5 minutes">
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
                      >
                        {val}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>



              <div className="vh-step-nav-row">
                <button
                  type="button"
                  className="vh-btn-step-next"
                  onClick={() => setActiveTab("instructions")}
                >
                  <span>Proceed to Step 2: Instructions & Notes</span>
                  <Icon name="arrowRight" />
                </button>
              </div>
            </div>
          ) : (
            <div className="vh-studio-card">
              <div className="vh-card-header">
                <h2>Candidate Instructions</h2>
                <p>Instructions displayed to students on screen before the test begins.</p>
              </div>

              {/* Candidate Pre-Exam Guidelines Manager */}
              <OnboardingInstructionsEditor
                showInstructions={details.show_onboarding_instructions ?? true}
                onToggleShowInstructions={(enabled) => onDetailsChange({ ...details, show_onboarding_instructions: enabled })}
                instructions={details.onboarding_instructions ?? []}
                onInstructionsChange={(items) => onDetailsChange({ ...details, onboarding_instructions: items })}
                isEditable={true}
              />

              <div className="vh-step-nav-row">
                <button
                  type="button"
                  className="vh-btn-step-back"
                  onClick={() => setActiveTab("config")}
                >
                  <Icon name="arrowLeft" />
                  <span>Back to Step 1: Configuration</span>
                </button>
              </div>
            </div>
          )}

          {/* Composite Source Modules Selection (for full_mock and final_test) */}
          {isComposite && (
            <div className="vh-studio-card vh-composite-card">
              <div className="vh-card-header">
                <h2>{t.compositeHeading}</h2>
                <p>{t.compositeDescription(typeLabel)}</p>
              </div>

              {loadingSources && <p className="source-loading">{t.loadingSources}</p>}

              <div className="vh-composite-grid">
                {SOURCE_SECTIONS.map((section) => {
                  const choices = sourceModules.filter((item) => item.module_type === section);
                  const sectionLabel = typeLabels[section];
                  const isSelected = Boolean(selectedSources[section]);

                  return (
                    <div className={`vh-source-box ${isSelected ? "is-selected" : ""}`} key={section}>
                      <div className="vh-source-header">
                        <span className={`section-chip section-${section}`}>{sectionLabel}</span>
                        <span className="vh-source-badge">{isSelected ? "✓ Attached" : "Required"}</span>
                      </div>

                      <SearchableSelect
                        id={`source-${section}`}
                        options={[
                          { value: "", label: t.selectCompleted(sectionLabel) },
                          ...choices.map((item) => ({
                            value: item.id,
                            label: t.sourceOption(item.title, item.question_count, item.status),
                          })),
                        ]}
                        value={selectedSources[section]}
                        onChange={(value) => onSelectedSourcesChange({ ...selectedSources, [section]: String(value) })}
                        searchPlaceholder={t.searchSourcePlaceholder(sectionLabel)}
                        className="form-dropdown-select"
                      />

                      {!loadingSources && !choices.length && (
                        <small className="vh-no-source">
                          {t.noCompleted(sectionLabel)}{" "}
                          <Link to={`${moduleWorkspacePath}/new/${section}`}>{t.createOneFirst}</Link>.
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
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

              <div className="vh-sim-readiness">
                <span className="vh-readiness-label">Status:</span>
                {details.title ? (
                  <span className="vh-readiness-val is-ready">✓ Ready to Create</span>
                ) : (
                  <span className="vh-readiness-val is-incomplete">Enter Title to Proceed</span>
                )}
              </div>
            </div>

            {/* Submit Action Box */}
            <div className="vh-submit-box">
              <button
                type="submit"
                className="vh-btn-primary-brand"
                disabled={busy || !details.title.trim() || (isComposite && !allSourcesSelected)}
              >
                <span>{busy ? t.creating : `Create ${typeLabel}`}</span>
                <Icon name="arrowRight" />
              </button>
              {isComposite && !allSourcesSelected && (
                <p className="vh-composite-warn-text">
                  Please select all 4 section modules above before creating.
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}


