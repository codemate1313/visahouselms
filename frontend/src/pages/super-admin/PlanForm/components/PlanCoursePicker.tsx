import { useMemo } from "react";
import { Checkbox } from "@/components/ui";
import { Icon } from "@/components/icons";
import { planFormStrings as strings } from "../PlanForm.strings";
import "../PlanForm.css";

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
  onSelectBatch?: (ids: number[], shouldSelect: boolean) => void;
}

function formatModuleType(type: string): string {
  if (!type) return "Course";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getModuleTypeClass(type: string): string {
  const norm = (type || "").toLowerCase().replace(/_/g, "-");
  return `type-${norm}`;
}

export function PlanCoursePicker({
  modules,
  selected,
  onToggle,
  onToggleAll,
  onSelectBatch,
}: PlanCoursePickerProps) {
  const t = strings.coursePicker;

  // Group modules by module_type
  const { moduleTypes, modulesByType } = useMemo(() => {
    const byType = new Map<string, PlanModule[]>();
    modules.forEach((mod) => {
      const type = mod.module_type || "other";
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(mod);
    });
    return {
      moduleTypes: Array.from(byType.keys()),
      modulesByType: byType,
    };
  }, [modules]);

  // Handle batch selection for a module type
  const handleToggleModuleType = (type: string) => {
    const typeMods = modulesByType.get(type) || [];
    if (typeMods.length === 0) return;

    const allTypeSelected = typeMods.every((m) => selected.has(m.id));
    const shouldSelect = !allTypeSelected;
    const ids = typeMods.map((m) => m.id);

    if (onSelectBatch) {
      onSelectBatch(ids, shouldSelect);
    } else {
      typeMods.forEach((m) => {
        const isSelected = selected.has(m.id);
        if (isSelected !== shouldSelect) {
          onToggle(m.id);
        }
      });
    }
  };

  const isAllSelected = modules.length > 0 && selected.size === modules.length;
  const isIndeterminate = selected.size > 0 && selected.size < modules.length;

  return (
    <fieldset className="plan-course-picker">
      <legend>{t.legend}</legend>
      <p className="hint">{t.hint}</p>

      {modules.length > 0 && (
        <div className="plan-course-toolbar">
          {/* Top Row: Master select all checkbox with count */}
          <div className="plan-course-toolbar-top">
            <label className="plan-course-select-all-box" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={isIndeterminate}
                onChange={onToggleAll}
              />
              <strong>{t.selectAll}</strong>
              <span className="plan-course-count-badge">
                {selected.size} of {modules.length} selected
              </span>
            </label>
          </div>

          {/* Bottom Row: Select by Module Chips */}
          {moduleTypes.length > 0 && (
            <div className="plan-course-module-bar">
              <span className="plan-course-module-label">Select by module:</span>

              {moduleTypes.map((type) => {
                const typeMods = modulesByType.get(type) || [];
                const selectedInType = typeMods.filter((m) => selected.has(m.id)).length;
                const isAllInType = selectedInType === typeMods.length && typeMods.length > 0;
                const isPartialInType = selectedInType > 0 && selectedInType < typeMods.length;

                return (
                  <button
                    key={type}
                    type="button"
                    className={`plan-course-module-chip ${
                      isAllInType ? "is-all-selected" : isPartialInType ? "is-partial-selected" : ""
                    }`}
                    onClick={() => handleToggleModuleType(type)}
                    title={`Click to ${isAllInType ? "deselect" : "select"} all ${formatModuleType(type)} courses`}
                  >
                    {isAllInType ? (
                      <Icon name="check" style={{ width: 13, height: 13 }} />
                    ) : (
                      <Icon name="plus" style={{ width: 12, height: 12 }} />
                    )}
                    <span>{formatModuleType(type)}</span>
                    <span className="plan-course-chip-count">
                      {selectedInType}/{typeMods.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Course Cards Grid: List all courses */}
      {!modules.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        <div className="plan-courses-grid">
          {modules.map((module) => {
            const isChecked = selected.has(module.id);
            return (
              <div
                key={module.id}
                className={`plan-course-card ${isChecked ? "is-selected" : ""}`}
                onClick={() => onToggle(module.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle(module.id);
                  }
                }}
              >
                <div className="plan-course-card-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isChecked} onChange={() => onToggle(module.id)} />
                </div>

                <div className="plan-course-card-body">
                  <div className="plan-course-card-header">
                    <span
                      className={`plan-course-type-pill ${getModuleTypeClass(module.module_type)}`}
                    >
                      {formatModuleType(module.module_type)}
                    </span>
                  </div>

                  <strong className="plan-course-card-title">{module.title}</strong>

                  <span className="plan-course-card-meta">
                    {module.duration_minutes} mins · {module.created_by_name || t.defaultAuthor}
                    {!module.is_visible && (
                      <span className="plan-course-hidden-pill">Hidden</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
