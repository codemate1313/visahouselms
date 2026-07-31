import type { StudentPlanModule } from "@/api/types";
import { ArrowIcon, ClockIcon, ModuleTypeIcon } from "../icons";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";
import { myCoursesStrings as strings } from "../MyCourses.strings";

interface AssignedTestsGridProps {
  modules: StudentPlanModule[];
  starting: number | null;
  onStartModule: (moduleId: number, moduleType: string, isLocked?: boolean) => void;
}

export function AssignedTestsGrid({ modules, starting, onStartModule }: AssignedTestsGridProps) {
  const typeLabels = strings.moduleTypeLabels;

  return (
    <div className="premium-tests-grid">
      {modules.map((module) => {
        const moduleId = module.module_id ?? module.id;
        if (!moduleId) return null;
        const isStarting = starting === moduleId;
        const isLocked = Boolean(module.is_locked);
        const moduleTypeClass = `type-${module.module_type || "default"}`;

        return (
          <div
            className={`premium-test-card ${moduleTypeClass}${isLocked ? " is-locked" : ""}`}
            key={moduleId}
          >
            {/* Ambient Background Glow Aura */}
            <div className="premium-card-ambient-aura" />

            {/* Locked Center Overlay */}
            {isLocked && (
              <div
                className="premium-lock-overlay"
                onClick={() => onStartModule(moduleId, module.module_type, true)}
                title="Click to unlock this test module"
              >
                <div className="premium-lock-orb">
                  <Icon name="lock" />
                </div>
                <span className="premium-lock-title">Locked Course</span>
              </div>
            )}

            {/* Card Header */}
            <div className="premium-card-header">
              <div className="premium-icon-box">
                <ModuleTypeIcon type={module.module_type} />
              </div>
              <span className="premium-type-chip">
                {typeLabels[module.module_type as keyof typeof typeLabels] ?? module.module_type}
              </span>
            </div>

            {/* Card Body */}
            <div className="premium-card-body">
              <h3 className="premium-card-title">{module.title}</h3>

              <div className="premium-card-meta-list">
                <span className="premium-meta-pill">
                  <ClockIcon /> {strings.minutesSuffix(module.duration_minutes)}
                </span>
                <span className="premium-meta-pill text-muted">
                  Academic Practice
                </span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="premium-card-footer">
              {isLocked ? (
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Icon name="lock" />}
                  rightIcon={<ArrowIcon />}
                  onClick={() => onStartModule(moduleId, module.module_type, true)}
                  className="start-test-btn is-locked"
                >
                  Unlock Plan
                </Button>
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  isLoading={isStarting}
                  rightIcon={<ArrowIcon />}
                  onClick={() => onStartModule(moduleId, module.module_type, false)}
                  className="start-test-btn"
                >
                  {strings.startTest}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
