import type { FormEvent } from "react";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { Course, QuestionBank } from "@/api/types";
import { questionBankEditorStrings as strings } from "../QuestionBankEditor.strings";

interface BankFormState {
  course_id: string;
  title: string;
  description: string;
  section: string;
}

interface BankDetailsFormProps {
  isNew: boolean;
  bank: QuestionBank | null;
  bankForm: BankFormState;
  onBankFormChange: (form: BankFormState) => void;
  courses: Course[];
  canEdit: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onDelete: () => void;
}

export function BankDetailsForm({ isNew, bank, bankForm, onBankFormChange, courses, canEdit, saving, onSubmit, onDelete }: BankDetailsFormProps) {
  const t = strings.bankDetails;
  const sections = t.sectionLabels;
  return (
    <form className="form-card wide bank-details-form" onSubmit={onSubmit}>
      <h2>{t.heading}</h2>
      <div className="form-grid">
        <div>
          <label htmlFor="bank-course">{t.courseLabel}</label>
          <SearchableSelect
            id="bank-course"
            options={courses.map((course) => ({ value: course.id, label: course.title }))}
            value={bankForm.course_id}
            onChange={(value) => onBankFormChange({ ...bankForm, course_id: String(value) })}
            disabled={!canEdit}
            searchPlaceholder={t.searchCoursesPlaceholder}
            className="form-dropdown-select"
          />
        </div>
        <div>
          <label htmlFor="bank-section">{t.sectionLabel}</label>
          <SearchableSelect
            id="bank-section"
            options={[
              { value: "listening", label: sections.listening },
              { value: "reading", label: sections.reading },
              { value: "writing", label: sections.writing },
              { value: "speaking", label: sections.speaking },
            ]}
            value={bankForm.section}
            onChange={(value) => onBankFormChange({ ...bankForm, section: String(value) })}
            disabled={!canEdit}
            searchable={false}
            className="form-dropdown-select"
          />
        </div>
      </div>
      <label htmlFor="bank-title">{t.titleLabel}<RequiredMark /></label>
      <input
        id="bank-title"
        value={bankForm.title}
        onChange={(event) => onBankFormChange({ ...bankForm, title: event.target.value })}
        maxLength={200}
        required
        readOnly={!canEdit}
      />
      <label htmlFor="bank-description">{t.descriptionLabel}</label>
      <textarea
        id="bank-description"
        value={bankForm.description}
        onChange={(event) => onBankFormChange({ ...bankForm, description: event.target.value })}
        rows={3}
        maxLength={1000}
        readOnly={!canEdit}
      />
      {canEdit && (
        <div className="form-actions">
          <button type="submit" disabled={saving || !bankForm.course_id}>
            {saving ? t.saving : isNew ? t.createBank : t.saveDetails}
          </button>
          {bank && (
            <button type="button" className="danger-text" onClick={onDelete}>
              {t.deleteBank}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
