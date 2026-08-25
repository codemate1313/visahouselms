import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";
import type { InstructorCourseUsage } from "../types";

const TYPE_LABELS: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  full_mock: "Full Mock",
  final_test: "Final Test",
};

interface CourseUsagePanelProps {
  courses: InstructorCourseUsage[];
}

export function CourseUsagePanel({ courses }: CourseUsagePanelProps) {
  return (
    <section className="workspace-panel instructor-course-usage" aria-labelledby="course-usage-title">
      <div className="panel-heading">
        <div>
          <h2 id="course-usage-title">{strings.courseUsage.title}</h2>
          <p>{strings.courseUsage.description}</p>
        </div>
        <span className="phase-chip">{strings.courseUsage.badge(courses.length)}</span>
      </div>

      {courses.length === 0 ? (
        <div className="instructor-course-usage-empty">
          <strong>{strings.courseUsage.emptyTitle}</strong>
          <p>{strings.courseUsage.emptyDescription}</p>
        </div>
      ) : (
        <div className="table-wrap instructor-course-usage-table-wrap">
          <table className="data-table instructor-course-usage-table">
            <thead>
              <tr>
                <th>{strings.courseUsage.columns.course}</th>
                <th>{strings.courseUsage.columns.type}</th>
                <th>{strings.courseUsage.columns.learners}</th>
                <th>{strings.courseUsage.columns.attempts}</th>
                <th>{strings.courseUsage.columns.completion}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.module_id}>
                  <td data-label={strings.courseUsage.columns.course}>
                    <div className="instructor-course-title">
                      <strong>{course.title}</strong>
                      <span>{strings.courseUsage.gradedDetail(course.completed_attempts)}</span>
                    </div>
                  </td>
                  <td data-label={strings.courseUsage.columns.type}>
                    <span className="instructor-course-type">{TYPE_LABELS[course.module_type] ?? course.module_type}</span>
                  </td>
                  <td data-label={strings.courseUsage.columns.learners}>{course.learners.toLocaleString("en-IN")}</td>
                  <td data-label={strings.courseUsage.columns.attempts}>{course.attempts.toLocaleString("en-IN")}</td>
                  <td data-label={strings.courseUsage.columns.completion}>
                    <div className="instructor-course-completion">
                      <span>{course.completion_rate}%</span>
                      <div className="instructor-course-completion-track" aria-hidden="true">
                        <i style={{ width: `${course.completion_rate}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
