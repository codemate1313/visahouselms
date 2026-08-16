import type { AssignedCourseSummary } from "../types";
import { Icon } from "@/components/icons";

interface AssignedCoursesPanelProps {
  courses: AssignedCourseSummary[];
}

export function AssignedCoursesPanel({ courses }: AssignedCoursesPanelProps) {
  return (
    <section className="workspace-panel assigned-courses-panel">
      <div className="panel-heading">
        <div>
          <h2>Assigned Courses</h2>
          <p>Courses licensed and assigned to your institute students.</p>
        </div>
      </div>
      {courses.length ? (
        <div className="courses-simple-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {courses.map((course) => (
            <div 
              key={course.id} 
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                gap: "12px"
              }}
            >
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                  {course.title}
                </h4>
                {course.summary && (
                  <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--text)", opacity: 0.7, lineBreak: "anywhere" }}>
                    {course.summary}
                  </p>
                )}
                <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "11px", color: "var(--text)", opacity: 0.6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Icon name="clock" style={{ width: "12px", height: "12px" }} />
                    {course.estimated_duration_minutes ? `${Math.round(course.estimated_duration_minutes / 60)}h` : "Self-paced"}
                  </span>
                  <span>•</span>
                  <span style={{ textTransform: "capitalize" }}>
                    {course.level.replace("_", " ")}
                  </span>
                </div>
              </div>
              <span 
                className="badge"
                style={{
                  background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                  color: "var(--primary)",
                  borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)"
                }}
              >
                Licensed
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-message">No courses have been assigned to your institute yet.</p>
      )}
    </section>
  );
}
