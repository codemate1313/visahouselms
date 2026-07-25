import { Link } from "react-router-dom";
import type { Assessment } from "@/api/types";
import { testsStrings as strings } from "../Tests.strings";

const STATUS_CLASS: Record<string, string> = { draft: "badge-amber", published: "badge-green", archived: "badge-gray" };

interface TestGridProps {
  tests: Assessment[];
}

export function TestGrid({ tests }: TestGridProps) {
  const typeLabels = strings.typeLabels;
  return (
    <div className="test-card-grid">
      {tests.map((test) => (
        <Link className="test-card" to={`/super-admin/instructor/tests/${test.id}`} key={test.id}>
          <div className="test-card-head">
            <span className={`badge ${STATUS_CLASS[test.status]}`}>{test.status}</span>
            <span>{typeLabels[test.assessment_type as keyof typeof typeLabels]}</span>
          </div>
          <h2>{test.title}</h2>
          <p>{test.description || strings.noDescription}</p>
          <dl>
            <div>
              <dt>{strings.questions}</dt>
              <dd>{test.question_count}</dd>
            </div>
            <div>
              <dt>{strings.points}</dt>
              <dd>{test.total_points}</dd>
            </div>
            <div>
              <dt>{strings.time}</dt>
              <dd>{test.duration_minutes ? strings.minutesSuffix(test.duration_minutes) : strings.untimed}</dd>
            </div>
          </dl>
          <small>{strings.courseByAuthor(test.course_title, test.created_by_name)}</small>
        </Link>
      ))}
    </div>
  );
}
