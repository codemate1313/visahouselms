import { Link } from "react-router-dom";
import type { StudentPlanModule } from "@/api/types";
import { ArrowIcon, ModuleTypeIcon } from "../icons";
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
        const isDemo = Boolean(module.is_demo);
        const isExhausted = Boolean(module.is_exhausted);
        const retakeAvailable = Boolean(module.retake_available);
        const moduleTypeClass = `type-${module.module_type || "default"}`;

        const categoryTitle = typeLabels[module.module_type as keyof typeof typeLabels] ?? module.module_type;

        return (
          <div
            className={`premium-test-card ${moduleTypeClass}${isLocked ? " is-locked" : ""}${isExhausted ? " is-exhausted" : ""}`}
            key={moduleId}
          >
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
                <span className="premium-lock-title">Course Locked</span>
                <span className="premium-lock-sub">Upgrade your plan to unlock</span>
              </div>
            )}

            {/* Top Bar: Icon on Left, Status Badge on Right */}
            <div className="premium-card-top-bar">
              <div className="premium-icon-box">
                <ModuleTypeIcon type={module.module_type} />
              </div>

              {isExhausted ? (
                <span className="premium-status-badge is-exhausted" title={strings.attemptStatus.exhaustedTooltip}>
                  <span className="badge-dot" />
                  <span>Completed</span>
                </span>
              ) : retakeAvailable ? (
                <span className="premium-status-badge is-retake">
                  <span className="badge-dot" />
                  <span>Retake Ready</span>
                </span>
              ) : isDemo && !isLocked ? (
                <span className="premium-status-badge is-demo" title={strings.demo.chipTooltip}>
                  <span className="badge-dot" />
                  <span>Free Trial</span>
                </span>
              ) : !isLocked ? (
                <span className="premium-status-badge is-ready">
                  <span className="badge-dot" />
                  <span>Ready</span>
                </span>
              ) : null}
            </div>

            {/* Middle: Full-width Title & Subtitle */}
            <div className="premium-card-content">
              <h3 className="premium-card-title" title={module.title}>
                {module.title}
              </h3>
              <p className="premium-category-sub">
                {strings.minutesSuffix(module.duration_minutes)} · {categoryTitle}
              </p>
            </div>

            {/* Card Footer: High-contrast Action CTA */}
            <div className="premium-card-footer">
              {isLocked ? (
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Icon name="lock" />}
                  rightIcon={<ArrowIcon />}
                  onClick={() => onStartModule(moduleId, module.module_type, true)}
                  className="start-test-btn is-locked-btn"
                >
                  Unlock Course
                </Button>
              ) : isExhausted ? (
                module.latest_attempt_id ? (
                  <Link to={`/student/attempts/${module.latest_attempt_id}/result/details`} style={{ width: "100%", textDecoration: "none" }}>
                    <Button
                      variant="outline"
                      fullWidth
                      rightIcon={<ArrowIcon />}
                      className="start-test-btn is-exhausted-btn"
                    >
                      View  Result
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled
                    className="start-test-btn is-exhausted-btn"
                    title={strings.attemptStatus.exhaustedTooltip}
                  >
                    Attempt Completed
                  </Button>
                )
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  isLoading={isStarting}
                  rightIcon={<ArrowIcon />}
                  onClick={() => onStartModule(moduleId, module.module_type, false)}
                  className="start-test-btn is-start-btn"
                >
                  {retakeAvailable
                    ? strings.attemptStatus.startRetakeBtn
                    : isDemo
                    ? strings.demo.startTest
                    : strings.startTest}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
