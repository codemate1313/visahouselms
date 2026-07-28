import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Checkbox, LinkButton, SearchInput, SearchableSelect } from "@/components/ui";
import type { Assessment, Question } from "@/api/types";
import { testEditorStrings as strings } from "../TestEditor.strings";
import { IELTS_SECTION_OPTIONS } from "@/constants";

interface QuestionPickerPanelProps {
  test: Assessment;
  available: Question[];
  filtered: Question[];
  search: string;
  onSearchChange: (value: string) => void;
  section: string;
  onSectionChange: (value: string) => void;
  questionIds: number[];
  canEdit: boolean;
  onToggleQuestion: (questionId: number) => void;
  onToggleAllFiltered: () => void;
}

export function QuestionPickerPanel({
  test,
  available,
  filtered,
  search,
  onSearchChange,
  section,
  onSectionChange,
  questionIds,
  canEdit,
  onToggleQuestion,
  onToggleAllFiltered,
}: QuestionPickerPanelProps) {
  const t = strings.questionPicker;
  return (
    <CollapsiblePanel
      className="authoring-panel"
      title={t.heading}
      description={t.description}
      badge={<span className="count-chip">{t.shownCount(filtered.length)}</span>}
    >
      <div className="question-picker-filters">
        <SearchInput value={search} onChange={onSearchChange} placeholder={t.searchPlaceholder} width={220} />
        <SearchableSelect
          options={[
            ...IELTS_SECTION_OPTIONS,
          ]}
          value={section}
          onChange={(value) => onSectionChange(String(value))}
          searchable={false}
          className="status-filter-select"
        />
        {canEdit && filtered.length > 0 && (
          <button type="button" className="secondary-button" onClick={onToggleAllFiltered}>
            {filtered.every((question) => questionIds.includes(question.id)) ? t.deselectAll : t.selectAll}
          </button>
        )}
      </div>
      {!available.length ? (
        <div className="empty-state compact-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyDescription(test.course_title)}</p>
          <LinkButton to="/super-admin/instructor/question-banks/new">
            {t.newQuestionBank}
          </LinkButton>
        </div>
      ) : (
        <div className="question-picker-list">
          {filtered.map((question) => (
            <label className={`question-picker-item${questionIds.includes(question.id) ? " chosen" : ""}`} key={question.id}>
              <Checkbox disabled={!canEdit} checked={questionIds.includes(question.id)} onChange={() => onToggleQuestion(question.id)} />
              <span>
                <strong>{question.prompt}</strong>
                <small>
                  {question.section} · {question.bank_title} · {question.points} {t.pointsSuffix}
                </small>
              </span>
            </label>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
