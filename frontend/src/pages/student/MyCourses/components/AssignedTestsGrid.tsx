import type { StudentPlanModule } from "@/api/types";
import { ArrowIcon, ClockIcon, ModuleTypeIcon, SpinnerIcon } from "../icons";
import { myCoursesStrings as strings } from "../MyCourses.strings";

function moduleTone(type: string) {
  switch (type) {
    case "reading": return "rose";
    case "speaking": return "emerald";
    case "writing": return "amber";
    case "listening": return "indigo";
    default: return "purple";
  }
}

interface AssignedTestsGridProps {
  modules: StudentPlanModule[];
  starting: number | null;
  onStartModule: (moduleId: number, moduleType: string) => void;
}

export function AssignedTestsGrid({ modules, starting, onStartModule }: AssignedTestsGridProps) {
  const typeLabels = strings.moduleTypeLabels;
  return (
    <div className="assigned-tests-grid">
      {modules.map((module) => {
        const moduleId = module.module_id ?? module.id;
        if (!moduleId) return null;
        const isStarting = starting === moduleId;
        return (
          <div className="assigned-test-card" data-tone={moduleTone(module.module_type)} key={moduleId}>
            <div className="assigned-test-top">
              <div className="assigned-test-icon">
                <ModuleTypeIcon type={module.module_type} />
              </div>
              <span className="assigned-test-chip">{typeLabels[module.module_type as keyof typeof typeLabels] ?? module.module_type}</span>
            </div>
            <h2>{module.title}</h2>
            <p className="assigned-test-duration">
              <ClockIcon /> {strings.minutesSuffix(module.duration_minutes)}
            </p>
            <button className="start-test-btn" disabled={isStarting} onClick={() => onStartModule(moduleId, module.module_type)}>
              {isStarting ? (
                <>
                  <SpinnerIcon /> {strings.starting}
                </>
              ) : (
                <>
                  {strings.startTest} <ArrowIcon />
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
