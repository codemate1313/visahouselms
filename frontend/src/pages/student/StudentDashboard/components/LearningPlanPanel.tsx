import type { StudentCurrentPlan } from "@/api/types";
import { DashboardButton } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import { moduleTone } from "../helpers";
import type { TestProgressItem } from "../types";
import { Icon } from "@/components/icons";

interface LearningPlanPanelProps {
  isInstituteStudent: boolean;
  plan: StudentCurrentPlan["plan"];
  testProgress: TestProgressItem[];
  completedTests: number;
  pendingTests: number;
}

export function LearningPlanPanel({ isInstituteStudent, plan, testProgress, completedTests, pendingTests }: LearningPlanPanelProps) {
  const t = strings.learningPlan;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{isInstituteStudent ? t.instituteHeading : t.directHeading}</h2>
          <p>{isInstituteStudent ? t.instituteDescription : t.directDescription}</p>
        </div>
        {plan && testProgress.length > 0 && (
          <div className="sd-progress-summary">
            <span>
              <strong>{completedTests}</strong> {t.completedSuffix}
            </span>
            <span>
              <strong>{pendingTests}</strong> {t.pendingSuffix}
            </span>
          </div>
        )}
      </div>
      {plan && testProgress.length ? (
        <div className="sd-test-list">
          {testProgress.map((item) => (
            <article className="sd-test-card" data-tone={moduleTone(item.module.module_type)} key={item.moduleId || item.module.title}>
              <div className="sd-test-card-top">
                <div>
                  <span className="sd-test-type">{item.module.module_type.replaceAll("_", " ")}</span>
                  <h3>{item.module.title}</h3>
                </div>
                <strong className="sd-test-percent">{item.progress}%</strong>
              </div>
              <div className="sd-test-meta">
                <span>{item.statusLabel}</span>
                <span>{t.minutesSuffix(item.module.duration_minutes)}</span>
              </div>
              <div className="sd-progress-track" aria-label={`${item.module.title} progress ${item.progress}%`}>
                <span className="sd-progress-fill" data-progress={item.progress} style={{ width: `${item.progress}%` }} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-message">{isInstituteStudent ? t.instituteEmpty : t.directEmpty}</p>
      )}
      <DashboardButton to="/student/my-courses" variant="secondary" className="panel-cta" rightIcon={<Icon name="arrowRight" />}>
        {t.goToMyTests}
      </DashboardButton>
    </section>
  );
}
