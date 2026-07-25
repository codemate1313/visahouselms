import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "../CourseAssignments.strings";

interface CourseHeaderActionsProps {
  course: Course;
  onToggleVisibility: () => void;
  onChangeStatus: (status: string) => void;
  onRemoveCourse: () => void;
}

export function CourseHeaderActions({ course, onToggleVisibility, onChangeStatus, onRemoveCourse }: CourseHeaderActionsProps) {
  return (
    <div className="form-actions course-admin-actions">
      <button onClick={onToggleVisibility}>{course.is_visible ? strings.hideFromWebsite : strings.showOnWebsite}</button>
      {course.status !== "published" && <button onClick={() => onChangeStatus("published")}>{strings.publish}</button>}
      {course.status === "published" && (
        <button className="secondary-button" onClick={() => onChangeStatus("archived")}>
          {strings.archive}
        </button>
      )}
      <button className="danger" onClick={onRemoveCourse}>
        {strings.deleteCourse}
      </button>
    </div>
  );
}
