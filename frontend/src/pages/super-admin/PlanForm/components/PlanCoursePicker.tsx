import { planFormStrings as strings } from "../PlanForm.strings";

export interface PlanModule {
  id: number;
  title: string;
  module_type: string;
  duration_minutes: number;
  is_visible: boolean;
  created_by_name?: string;
}

interface PlanCoursePickerProps {
  modules: PlanModule[];
  selected: Set<number>;
  onToggle: (moduleId: number) => void;
  onToggleAll: () => void;
}

export function PlanCoursePicker({ modules, selected, onToggle, onToggleAll }: PlanCoursePickerProps) {
  const t = strings.coursePicker;
  return (
    <fieldset className="plan-course-picker">
      <legend>{t.legend}</legend>
      <p className="hint">{t.hint}</p>
      {modules.length > 0 && (
        <label className="plan-course-option select-all-option">
          <input
            type="checkbox"
            checked={selected.size === modules.length}
            ref={(el) => {
              if (el) el.indeterminate = selected.size > 0 && selected.size < modules.length;
            }}
            onChange={onToggleAll}
          />
          <span>
            <strong>{t.selectAll}</strong>
          </span>
        </label>
      )}
      {!modules.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        modules.map((module) => (
          <label className="plan-course-option" key={module.id}>
            <input type="checkbox" checked={selected.has(module.id)} onChange={() => onToggle(module.id)} />
            <span>
              <strong>{module.title}</strong>
              <small>
                {module.module_type.replaceAll("_", " ")} · {module.duration_minutes} minutes · {module.created_by_name || t.defaultAuthor}
                {module.is_visible ? "" : t.hiddenSuffix}
              </small>
            </span>
          </label>
        ))
      )}
    </fieldset>
  );
}
