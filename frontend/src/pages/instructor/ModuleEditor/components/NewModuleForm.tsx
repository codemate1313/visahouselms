import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { usePageTitleStore } from "@/store/pageTitleStore";
import type { ExamModule, ExamModuleType, ExamSection } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { COMPOSITE_TYPES, MOCK_SOURCE_TYPES, DERIVED_DURATION_MODULE_TYPES, SOURCE_SECTIONS, MODULE_TYPE_META } from "../helpers";
import type { ModuleDetailsState } from "./ModuleDetailsForm";
import { OnboardingInstructionsEditor } from "./OnboardingInstructionsEditor";
import { HorizontalAuthoringStepper } from "./HorizontalAuthoringStepper";

interface NewModuleFormProps {
  requestedType: ExamModuleType | null;
  details: ModuleDetailsState;
  onDetailsChange: (details: ModuleDetailsState) => void;
  sourceModules: ExamModule[];
  selectedSources: Record<ExamSection, string>;
  onSelectedSourcesChange: (sources: Record<ExamSection, string>) => void;
  loadingSources: boolean;
  busy: boolean;
  error: string | null;
  moduleWorkspacePath: string;
  onSubmit: (event: FormEvent) => void;
  moduleImportFile: File | null;
  onModuleImportFileChange: (file: File | null) => void;
  /** Called when the user clicks Shuffle. Returns which sections had no fresh modules. */
  onShuffle?: () => { exhaustedSections: ExamSection[] };
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
  onShuffle,
  moduleImportFile,
  onModuleImportFileChange,
}: NewModuleFormProps) {
  const t = strings.newModule;
  const typeLabels = strings.typeLabels;
  const [activeTab, setActiveTab] = useState<"config" | "instructions">("config");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [exhaustedSections, setExhaustedSections] = useState<ExamSection[]>([]);
  const setCustomBreadcrumbs = usePageTitleStore((state) => state.setCustomBreadcrumbs);

  const typeLabel = requestedType ? typeLabels[requestedType] : "";

  useEffect(() => {
    if (!requestedType) return;
    setCustomBreadcrumbs([
      { label: "All Modules", path: moduleWorkspacePath },
      { label: `Create ${typeLabel}` },
    ]);
    return () => setCustomBreadcrumbs(null);
  }, [requestedType, typeLabel, moduleWorkspacePath, setCustomBreadcrumbs]);

  if (!requestedType) {
    return (
      <div className="empty-state">
        <h1>{strings.unknownType.title}</h1>
        <Link to={moduleWorkspacePath}>{strings.unknownType.backLink}</Link>
      </div>
    );
  }

  const meta = MODULE_TYPE_META[requestedType];
  const isComposite = COMPOSITE_TYPES.has(requestedType);
  const usesMockSources = MOCK_SOURCE_TYPES.has(requestedType);
  const durationIsCalculated = DERIVED_DURATION_MODULE_TYPES.has(requestedType);
  const allSourcesSelected = SOURCE_SECTIONS.every((section) => selectedSources[section]);
  const selectedSourceDuration = usesMockSources
    ? SOURCE_SECTIONS.reduce((total, section) => {
        const moduleId = Number(selectedSources[section]);
        return total + (sourceModules.find((module) => module.id === moduleId)?.duration_minutes ?? 0);
      }, 0)
    : 0;
  const displayedDuration = usesMockSources
    ? selectedSourceDuration || meta.defaultDuration
    : durationIsCalculated
      ? meta.defaultDuration
      : details.duration_minutes || meta.defaultDuration;

  const handleNextStep = () => {
    if (!details.title.trim()) {
      setValidationError("Module Title is required before proceeding to Step 2.");
      document.getElementById("new-module-title")?.focus();
      return;
    }
    if (usesMockSources && !moduleImportFile && !allSourcesSelected) {
      setValidationError("Please select all 4 required source modules or upload one full module PDF/CSV before proceeding.");
      return;
    }
    setValidationError(null);
    setActiveTab("instructions");
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const handleSubmit = (event: FormEvent) => {
    if (activeTab === "config") {
      event.preventDefault();
      handleNextStep();
    } else {
      onSubmit(event);
    }
  };

  const adjustDuration = (delta: number) => {
    const next = Math.max(1, Math.min(600, (details.duration_minutes || meta.defaultDuration) + delta));
    onDetailsChange({ ...details, duration_minutes: next });
  };

  const setDurationPreset = (val: number) => {
    onDetailsChange({ ...details, duration_minutes: val });
  };

  return (
    <div className="new-module-studio-container">
      {error && <p className="error-text notice-line">{error}</p>}

      {/* 2. Compact & Elegant Hero Header Banner */}
      <div className="vh-brand-hero-banner">
        <div className="vh-hero-header-top">
          <div className="vh-hero-title-group">
            <div className="vh-hero-chip-group">
              <span className="vh-chip-white-solid">{typeLabel}</span>
            </div>
            <h1 className="vh-hero-title">Author New {typeLabel} Test</h1>
          </div>
          <div className="vh-duration-quick-badge">
            <Icon name="history" />
            <span>{durationIsCalculated ? "Calculated" : "Target"}: <strong>{displayedDuration} mins</strong></span>
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
        </div>
      </div>

      {/* 3. Concise Horizontal Authoring Stepper Bar */}
      <HorizontalAuthoringStepper
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "instructions" && !details.title.trim()) {
            setValidationError("Module Title is required before proceeding to Step 2.");
            document.getElementById("new-module-title")?.focus();
            return;
          }
          setValidationError(null);
          setActiveTab(tab);
        }}
        hasTitle={!!details.title.trim()}
        hasInstructions={(details.show_onboarding_instructions ?? true) ? (details.onboarding_instructions && details.onboarding_instructions.length > 0) : true}
      />

      {/* 4. Interactive Studio Form */}
      <form onSubmit={handleSubmit} className="vh-studio-grid">
        {/* Main Column: Form Controls with Stage Animation */}
        <div className="vh-studio-main-col stage-fade-in" key={activeTab}>
          {activeTab === "config" ? (
            <div className="vh-studio-card">
              <div className="vh-card-header">
                <h2>Module Basic Details</h2>
                <p>Define the title and exam duration for this assessment.</p>
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
                    className={`vh-input-enhanced ${validationError && !details.title.trim() ? "is-invalid" : ""}`}
                    value={details.title}
                    onChange={(event) => {
                      setValidationError(null);
                      onDetailsChange({ ...details, title: event.target.value });
                    }}
                    placeholder={t.titlePlaceholder(typeLabel)}
                    maxLength={200}
                    required
                    autoFocus
                  />
                  {details.title && (
                    <IconButton
                      className="vh-clear-btn"
                      onClick={() => onDetailsChange({ ...details, title: "" })}
                      label="Clear title"
                      showTooltip={false}
                      icon={<Icon name="cross" />}
                    />
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
                  <label htmlFor="new-module-duration">
                    {durationIsCalculated ? t.calculatedDurationLabel : "Exam Duration (Minutes)"} <RequiredMark />
                  </label>
                </div>

                <div className="vh-duration-stepper-row">
                  <div className="vh-stepper-control">
                    <IconButton
                      className="vh-step-btn"
                      onClick={() => adjustDuration(-5)}
                      disabled={durationIsCalculated}
                      label="Subtract 5 minutes"
                      icon={<Icon name="minus" />}
                    />
                    <div className="vh-duration-val-box">
                      <input
                        id="new-module-duration"
                        type="number"
                        className="vh-duration-input"
                        min={1}
                        max={600}
                        value={displayedDuration}
                        onChange={(event) => onDetailsChange({ ...details, duration_minutes: Number(event.target.value) })}
                        required
                        readOnly={durationIsCalculated}
                      />
                      <span className="vh-stepper-unit">mins</span>
                    </div>
                    <IconButton
                      className="vh-step-btn"
                      onClick={() => adjustDuration(5)}
                      disabled={durationIsCalculated}
                      label="Add 5 minutes"
                      icon={<Icon name="plus" />}
                    />
                  </div>

                  {!durationIsCalculated && (
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
                  )}
                </div>
                {durationIsCalculated && (
                  <p className="field-hint">
                    {usesMockSources
                      ? t.calculatedCompositeDurationHint
                      : isComposite
                        ? t.calculatedFinalTestDurationHint
                        : t.calculatedSpeakingDurationHint}
                  </p>
                )}
              </div>

              <div className="vh-form-group">
                <div className="vh-label-row">
                  <label htmlFor="new-module-full-upload">{strings.moduleImport.fileLabel}</label>
                </div>
                <p className="field-hint">
                  {isComposite && !usesMockSources
                    ? t.finalTestUploadHint
                    : strings.moduleImport.createHint(typeLabel)}
                </p>
                <input
                  id="new-module-full-upload"
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  onChange={(event) => onModuleImportFileChange(event.target.files?.[0] ?? null)}
                />
                {moduleImportFile && <p className="field-hint">Selected: {moduleImportFile.name}</p>}
              </div>
            </div>
          ) : (
            <OnboardingInstructionsEditor
              showInstructions={details.show_onboarding_instructions ?? true}
              onToggleShowInstructions={(enabled) => onDetailsChange({ ...details, show_onboarding_instructions: enabled })}
              instructions={details.onboarding_instructions ?? []}
              onInstructionsChange={(items) => onDetailsChange({ ...details, onboarding_instructions: items })}
              isEditable={true}
            />
          )}

          {/* Source Modules Selection - Full Mock only. Final Test is authored
              from its own custom per-section uploads, like a standalone module. */}
          {usesMockSources && (
            <div className="vh-studio-card vh-composite-card">
              <div className="vh-card-header">
                <div className="vh-composite-header-row">
                  <div>
                    <h2>{t.compositeHeading}</h2>
                    <p>{t.compositeDescription(typeLabel)}</p>
                  </div>
                  {onShuffle && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="vh-btn-shuffle"
                      onClick={() => {
                        const result = onShuffle();
                        setExhaustedSections(result.exhaustedSections);
                      }}
                      disabled={loadingSources || sourceModules.length === 0}
                      title={t.shuffleTitle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                      </svg>
                      {t.shuffle}
                    </Button>
                  )}
                </div>
              </div>

              {/* Exhaustion warning – only shown after a shuffle reveals no fresh modules for a section */}
              {exhaustedSections.length > 0 && (
                <div className="vh-shuffle-warn-banner" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>
                    {t.shuffleExhaustedWarning(
                      exhaustedSections.map((s) => typeLabels[s]).join(", ")
                    )}
                  </span>
                </div>
              )}

              {loadingSources && <p className="source-loading">{t.loadingSources}</p>}

              <div className="vh-composite-grid">
                {SOURCE_SECTIONS.map((section) => {
                  const choices = sourceModules.filter((item) => item.module_type === section);
                  const sectionLabel = typeLabels[section];
                  const isSelected = Boolean(selectedSources[section]);
                  const isExhausted = exhaustedSections.includes(section);

                  return (
                    <div className={`vh-source-box ${isSelected ? "is-selected" : ""} ${isExhausted ? "is-exhausted" : ""}`} key={section}>
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
                        onChange={(value) => {
                          setExhaustedSections((prev) => prev.filter((s) => s !== section));
                          onSelectedSourcesChange({ ...selectedSources, [section]: String(value) });
                        }}
                        searchPlaceholder={t.searchSourcePlaceholder(sectionLabel)}
                        className="form-dropdown-select"
                      />

                      {isExhausted && (
                        <small className="vh-source-exhausted-hint">
                          {t.shuffleExhaustedSectionHint}
                        </small>
                      )}

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

          {/* Single Clean Bottom Action Bar */}
          {activeTab === "config" ? (
            <div className="vh-main-col-actions" style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Button
                type="button"
                variant="primary"
                className="vh-btn-primary-brand"
                onClick={handleNextStep}
              >
                <span>Next: Instructions & Notes</span>
                <Icon name="arrowRight" />
              </Button>
            </div>
          ) : (
            <div className="vh-main-col-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 16, flexWrap: "wrap" }}>
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

              <Button
                type="submit"
                variant="primary"
                className="vh-btn-primary-brand"
                disabled={busy || !details.title.trim() || (usesMockSources && !moduleImportFile && !allSourcesSelected)}
                style={{ minWidth: 220, padding: "12px 28px" }}
              >
                <span>{busy ? t.creating : `Create ${typeLabel}`}</span>
                <Icon name="arrowRight" />
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
