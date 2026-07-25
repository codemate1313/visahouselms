import type { FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { Assessment, Course } from "@/api/types";
import { testEditorStrings as strings } from "../TestEditor.strings";

interface TestFormState {
  course_id: string;
  title: string;
  description: string;
  assessment_type: string;
  duration_minutes: string;
  instructions: string;
}

interface TestDetailsFormProps {
  isNew: boolean;
  test: Assessment | null;
  courses: Course[];
  form: TestFormState;
  onFormChange: (form: TestFormState) => void;
  onCourseChange: (courseId: string) => void;
  canEdit: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onDelete: () => void;
}

export function TestDetailsForm({ isNew, test, courses, form, onFormChange, onCourseChange, canEdit, saving, onSubmit, onDelete }: TestDetailsFormProps) {
  const t = strings.details;
  const typeLabels = strings.typeLabels;
  return (
    <form className="form-card wide test-details-form collapsible-form-card" onSubmit={onSubmit}>
      <CollapsiblePanel className="form-card-collapsible" title={t.heading} description={t.description}>
        <div className="form-grid">
          <div>
            <label htmlFor="test-course">{t.courseLabel}</label>
            <SearchableSelect
              id="test-course"
              options={courses.map((course) => ({ value: course.id, label: course.title }))}
              value={form.course_id}
              disabled={!canEdit}
              onChange={(value) => onCourseChange(String(value))}
              searchPlaceholder={t.searchCoursesPlaceholder}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label htmlFor="test-type">{t.typeLabel}</label>
            <SearchableSelect
              id="test-type"
              options={[
                { value: "practice", label: typeLabels.practice },
                { value: "module_mock", label: typeLabels.module_mock },
                { value: "full_mock", label: typeLabels.full_mock },
                { value: "final", label: typeLabels.final },
              ]}
              value={form.assessment_type}
              disabled={!canEdit}
              onChange={(value) => onFormChange({ ...form, assessment_type: String(value) })}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
        </div>
        <label htmlFor="test-title">{t.titleLabel}<RequiredMark /></label>
        <input id="test-title" value={form.title} readOnly={!canEdit} onChange={(event) => onFormChange({ ...form, title: event.target.value })} required />
        <label htmlFor="test-description">{t.descriptionLabel}</label>
        <textarea id="test-description" rows={3} value={form.description} readOnly={!canEdit} onChange={(event) => onFormChange({ ...form, description: event.target.value })} />
        <label htmlFor="test-instructions">{t.instructionsLabel}</label>
        <textarea id="test-instructions" rows={4} value={form.instructions} readOnly={!canEdit} onChange={(event) => onFormChange({ ...form, instructions: event.target.value })} />
        <label htmlFor="test-duration">{t.durationLabel}</label>
        <input
          id="test-duration"
          type="number"
          min="1"
          max="600"
          value={form.duration_minutes}
          readOnly={!canEdit}
          onChange={(event) => onFormChange({ ...form, duration_minutes: event.target.value })}
          placeholder={t.durationPlaceholder}
        />
        {canEdit && (
          <div className="form-actions">
            <button type="submit" disabled={saving || !form.course_id}>
              {saving ? t.saving : isNew ? t.createTest : t.saveDetails}
            </button>
            {test && (
              <button type="button" className="danger-text" onClick={onDelete}>
                {t.deleteTest}
              </button>
            )}
          </div>
        )}
      </CollapsiblePanel>
    </form>
  );
}
