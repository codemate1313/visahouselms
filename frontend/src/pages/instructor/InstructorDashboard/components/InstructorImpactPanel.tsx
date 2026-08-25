import { Icon } from "@/components/icons";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";

interface ImpactDialProps {
  label: string;
  value: number;
  detail: string;
  tone: "primary" | "blue";
}

const DIAL_RADIUS = 42;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function ImpactDial({ label, value, detail, tone }: ImpactDialProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const offset = DIAL_CIRCUMFERENCE * (1 - normalizedValue / 100);

  return (
    <div className="instructor-impact-dial">
      <div className={`instructor-impact-ring is-${tone}`}>
        <svg viewBox="0 0 108 108" role="img" aria-label={`${label}: ${normalizedValue}%`}>
          <circle className="instructor-impact-ring-track" cx="54" cy="54" r={DIAL_RADIUS} />
          <circle
            className="instructor-impact-ring-value"
            cx="54"
            cy="54"
            r={DIAL_RADIUS}
            strokeDasharray={DIAL_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span>{normalizedValue}%</span>
      </div>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

interface InstructorImpactPanelProps {
  publishedCourses: number;
  coursesWithUsage: number;
  totalAttempts: number;
  completedAttempts: number;
  completedThisMonth: number;
  inProgressGradings: number;
}

export function InstructorImpactPanel({
  publishedCourses,
  coursesWithUsage,
  totalAttempts,
  completedAttempts,
  completedThisMonth,
  inProgressGradings,
}: InstructorImpactPanelProps) {
  const adoptionRate = publishedCourses > 0 ? Math.round((coursesWithUsage / publishedCourses) * 100) : 0;
  const completionRate = totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0;

  return (
    <section className="workspace-panel instructor-impact-panel" aria-labelledby="instructor-impact-title">
      <div className="panel-heading">
        <div>
          <h2 id="instructor-impact-title">{strings.impact.title}</h2>
          <p>{strings.impact.description}</p>
        </div>
        <span className="instructor-impact-icon" aria-hidden="true">
          <Icon name="analytics" />
        </span>
      </div>

      <div className="instructor-impact-dials">
        <ImpactDial
          label={strings.impact.adoption}
          value={adoptionRate}
          detail={strings.impact.adoptionDetail(coursesWithUsage, publishedCourses)}
          tone="primary"
        />
        <ImpactDial
          label={strings.impact.completion}
          value={completionRate}
          detail={strings.impact.completionDetail(completedAttempts, totalAttempts)}
          tone="blue"
        />
      </div>

      <div className="instructor-impact-footer">
        <span><strong>{completedThisMonth.toLocaleString("en-IN")}</strong>{strings.impact.gradedThisMonth}</span>
        <span><strong>{inProgressGradings.toLocaleString("en-IN")}</strong>{strings.impact.inProgress}</span>
      </div>
    </section>
  );
}
