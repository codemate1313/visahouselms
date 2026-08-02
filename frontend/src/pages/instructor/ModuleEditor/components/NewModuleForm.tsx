import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExamModule, ExamModuleType, IeltsSection } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { COMPOSITE_TYPES, SOURCE_SECTIONS } from "../helpers";

interface NewModuleFormProps {
  requestedType: ExamModuleType | null;
  details: { title: string; description: string; instructions: string; duration_minutes: number };
  onDetailsChange: (details: { title: string; description: string; instructions: string; duration_minutes: number }) => void;
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

  if (!requestedType) {
    return (
      <div className="empty-state">
        <h1>{strings.unknownType.title}</h1>
        <Link to={moduleWorkspacePath}>{strings.unknownType.backLink}</Link>
      </div>
    );
  }

  const typeLabel = typeLabels[requestedType];
  const isComposite = COMPOSITE_TYPES.has(requestedType);
  const allSourcesSelected = SOURCE_SECTIONS.every((section) => selectedSources[section]);

  return (
    <div>
      <div className="module-editor-breadcrumb-bar">
        <div className="module-editor-breadcrumb-left">
          <Link to={moduleWorkspacePath} className="button secondary module-back-btn">
            <Icon name="arrowLeft" />
            All Modules
          </Link>
          <div className="breadcrumb-trail">
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current-title">New {typeLabel}</span>
          </div>
        </div>
      </div>
      {error && <p className="error-text notice-line">{error}</p>}
      <form className="form-card module-create-form" onSubmit={onSubmit}>
        <span className={`section-chip section-${requestedType}`}>{typeLabel}</span>
        <label htmlFor="new-module-title">{t.titleLabel}<RequiredMark /></label>
        <input
          id="new-module-title"
          value={details.title}
          onChange={(event) => onDetailsChange({ ...details, title: event.target.value })}
          placeholder={t.titlePlaceholder(typeLabel)}
          maxLength={200}
          required
          autoFocus
        />
        <label htmlFor="new-module-description">{t.descriptionLabel}</label>
        <textarea
          id="new-module-description"
          rows={4}
          value={details.description}
          onChange={(event) => onDetailsChange({ ...details, description: event.target.value })}
          placeholder={t.descriptionPlaceholder}
        />
        <label htmlFor="new-module-instructions">{t.instructionsLabel}</label>
        <textarea
          id="new-module-instructions"
          rows={4}
          value={details.instructions}
          onChange={(event) => onDetailsChange({ ...details, instructions: event.target.value })}
          placeholder={t.instructionsPlaceholder}
        />
        {isComposite && (
          <section className="composite-source-panel">
            <h2>{t.compositeHeading}</h2>
            <p>{t.compositeDescription(typeLabel)}</p>
            {loadingSources && <p className="source-loading">{t.loadingSources}</p>}
            <div className="source-module-grid">
              {SOURCE_SECTIONS.map((section) => {
                const choices = sourceModules.filter((item) => item.module_type === section);
                const sectionLabel = typeLabels[section];
                return (
                  <div className="source-module-choice" key={section}>
                    <label htmlFor={`source-${section}`}>{sectionLabel}</label>
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
                      <small>
                        {t.noCompleted(sectionLabel)}{" "}
                        <Link to={`${moduleWorkspacePath}/new/${section}`}>{t.createOneFirst}</Link>.
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <button type="submit" disabled={busy || (isComposite && !allSourcesSelected)}>
          {busy ? t.creating : t.create(typeLabel)}
        </button>
      </form>
    </div>
  );
}
