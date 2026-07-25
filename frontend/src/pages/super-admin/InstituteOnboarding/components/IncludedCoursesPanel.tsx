import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import type { ModuleOption } from "../types";

interface IncludedCoursesPanelProps {
  modules: ModuleOption[];
  selectedModules: Set<number>;
  onToggleModule: (moduleId: number) => void;
  onToggleAll: () => void;
}

export function IncludedCoursesPanel({ modules, selectedModules, onToggleModule, onToggleAll }: IncludedCoursesPanelProps) {
  const t = strings.step1.includedCourses;
  return (
    <CollapsiblePanel
      className="form-card onboarding-section-card"
      title={t.title}
      description={t.description}
      badge={<span className="count-chip">{selectedModules.size}</span>}
    >
      <div className="plan-course-picker">
        {modules.length > 0 && (
          <label className="plan-course-option select-all-option">
            <input
              type="checkbox"
              checked={selectedModules.size === modules.length}
              ref={(el) => {
                if (el) el.indeterminate = selectedModules.size > 0 && selectedModules.size < modules.length;
              }}
              onChange={onToggleAll}
            />
            <span>
              <strong>{t.selectAll}</strong>
            </span>
          </label>
        )}
        {modules.map((module) => (
          <label className="plan-course-option" key={module.id}>
            <input type="checkbox" checked={selectedModules.has(module.id)} onChange={() => onToggleModule(module.id)} />
            <span>
              <strong>{module.title}</strong>
              <small>
                {module.module_type.replace("_", " ")} · {module.duration_minutes} {t.minsSuffix}
              </small>
            </span>
          </label>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
