import { useState } from "react";
import type { AssignedCourseSummary } from "../types";
import { Icon, type IconName } from "@/components/icons";
import { Modal } from "@/components/ui";

interface AssignedCoursesPanelProps {
  courses: AssignedCourseSummary[];
}

export function AssignedCoursesPanel({ courses }: AssignedCoursesPanelProps) {
  const [selectedCourse, setSelectedCourse] = useState<AssignedCourseSummary | null>(null);

  function formatDuration(minutes: number | null) {
    if (!minutes) return "Self-paced";
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  function formatLevel(level: string) {
    return level.replace("_", " ").toLowerCase();
  }

  function getCourseIcon(level: string): IconName {
    const normalizedLevel = level.toLowerCase();
    if (normalizedLevel.includes("listening")) return "headphones";
    if (normalizedLevel.includes("speaking")) return "microphone";
    if (normalizedLevel.includes("writing")) return "clipboard";
    return "book";
  }

  return (
    <section className="workspace-panel assigned-courses-panel">
      <div className="panel-heading assigned-courses-heading">
        <div>
          <h2>Assigned Courses</h2>
          <p>Courses licensed and assigned to your institute students.</p>
        </div>
        {courses.length > 0 && <span className="assigned-courses-count">{courses.length} active</span>}
      </div>
      {courses.length ? (
        <div className="assigned-course-list">
          {courses.map((course) => (
            <article
              aria-label={`View details for ${course.title}`}
              className="assigned-course-card"
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setSelectedCourse(course);
              }}
              role="button"
              tabIndex={0}
            >
              <span className="assigned-course-icon">
                <Icon name={getCourseIcon(course.level)} />
              </span>
              <span className="assigned-course-main">
                <span className="assigned-course-title-row">
                  <strong>{course.title}</strong>
                  <span className="assigned-course-license"><i /> Licensed</span>
                </span>
                {course.summary && <span className="assigned-course-summary">{course.summary}</span>}
                <span className="assigned-course-meta">
                  <span>
                    <Icon name="clock" />
                    {formatDuration(course.estimated_duration_minutes)}
                  </span>
                  <span>
                    <Icon name="award" />
                    {formatLevel(course.level)}
                  </span>
                </span>
              </span>
              <span className="assigned-course-open">
                <Icon name="arrowRight" />
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-message">No courses have been assigned to your institute yet.</p>
      )}

      <Modal
        className="course-detail-modal"
        onClose={() => setSelectedCourse(null)}
        open={selectedCourse !== null}
        size="md"
        title={selectedCourse?.title ?? "Course details"}
      >
        {selectedCourse && (
          <div className="course-detail-content">
            <div className="course-detail-hero">
              <span className="course-detail-icon">
                <Icon name={getCourseIcon(selectedCourse.level)} />
              </span>
              <div>
                <span className="course-detail-kicker">Licensed course</span>
                <p>{selectedCourse.summary || "This course is licensed to your institute and available for assigned students."}</p>
              </div>
            </div>

            <div className="course-detail-grid">
              <div>
                <span>Duration</span>
                <strong>{formatDuration(selectedCourse.estimated_duration_minutes)}</strong>
              </div>
              <div>
                <span>Skill area</span>
                <strong>{formatLevel(selectedCourse.level)}</strong>
              </div>
              <div>
                <span>Course slug</span>
                <strong>{selectedCourse.slug}</strong>
              </div>
            </div>

            <div className="course-detail-note">
              <Icon name="clipboard" />
              <span>Students can access this course while your institute subscription and course license remain active.</span>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
