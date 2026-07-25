import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "../CourseAssignments.strings";

interface CourseOverviewProps {
  course: Course;
}

export function CourseOverview({ course }: CourseOverviewProps) {
  const f = strings.facts;
  return (
    <div className="course-overview">
      <div>
        <span className={`badge ${course.status === "published" ? "badge-green" : course.status === "draft" ? "badge-amber" : "badge-gray"}`}>
          {course.status}
        </span>
        {!course.is_visible && <span className="badge badge-gray">hidden</span>}
        <h2>{course.summary || strings.noSummary}</h2>
        <p>{course.description || strings.noDescription}</p>
      </div>
      <dl>
        <div>
          <dt>{f.instructor}</dt>
          <dd>{course.created_by_name}</dd>
        </div>
        <div>
          <dt>{f.created}</dt>
          <dd>{new Date(course.created_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{f.published}</dt>
          <dd>{course.published_at ? new Date(course.published_at).toLocaleString() : f.notPublished}</dd>
        </div>
        <div>
          <dt>{f.modules}</dt>
          <dd>{course.modules.length}</dd>
        </div>
      </dl>
    </div>
  );
}
