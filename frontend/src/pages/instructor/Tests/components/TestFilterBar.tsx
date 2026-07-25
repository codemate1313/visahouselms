import type { FormEvent } from "react";
import { Button, Checkbox, SearchableSelect, SearchInput } from "@/components/ui";
import type { Course } from "@/api/types";
import { testsStrings as strings } from "../Tests.strings";

interface TestFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  courseId: string;
  onCourseIdChange: (value: string) => void;
  courses: Course[];
  status: string;
  onStatusChange: (value: string) => void;
  mine: boolean;
  onMineChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}

export function TestFilterBar({
  search,
  onSearchChange,
  courseId,
  onCourseIdChange,
  courses,
  status,
  onStatusChange,
  mine,
  onMineChange,
  onSubmit,
}: TestFilterBarProps) {
  const t = strings.statusLabels;
  return (
    <form className="filter-bar responsive-filters" onSubmit={onSubmit}>
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={220} />
      <SearchableSelect
        ariaLabel={strings.courseAriaLabel}
        options={[
          { value: "", label: strings.allCourses },
          ...courses.map((course) => ({ value: course.id, label: course.title })),
        ]}
        value={courseId}
        onChange={(value) => onCourseIdChange(String(value))}
        searchPlaceholder={strings.searchCoursesPlaceholder}
        className="status-filter-select"
      />
      <SearchableSelect
        ariaLabel={strings.statusAriaLabel}
        options={[
          { value: "", label: strings.allStatuses },
          { value: "draft", label: t.draft },
          { value: "published", label: t.published },
          { value: "archived", label: t.archived },
        ]}
        value={status}
        onChange={(value) => onStatusChange(String(value))}
        searchable={false}
        className="status-filter-select"
      />
      <label className="inline-check">
        <Checkbox checked={mine} onChange={(event) => onMineChange(event.target.checked)} /> {strings.myTests}
      </label>
      <Button type="submit" size="sm">
        {strings.search}
      </Button>
    </form>
  );
}
