import type { FormEvent } from "react";
import { Button, SearchableSelect, SearchInput } from "@/components/ui";
import type { Course } from "@/api/types";
import { questionBanksStrings as strings } from "../QuestionBanks.strings";

interface QuestionBankFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  section: string;
  onSectionChange: (value: string) => void;
  courseId: string;
  onCourseIdChange: (value: string) => void;
  courses: Course[];
  mine: boolean;
  onMineChange: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
}

export function QuestionBankFilterBar({
  search,
  onSearchChange,
  section,
  onSectionChange,
  courseId,
  onCourseIdChange,
  courses,
  mine,
  onMineChange,
  onSubmit,
}: QuestionBankFilterBarProps) {
  const sections = strings.sectionLabels;
  return (
    <form className="filter-bar responsive-filters" onSubmit={onSubmit}>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={strings.searchPlaceholder}
        aria-label={strings.searchAriaLabel}
        width={220}
      />
      <SearchableSelect
        ariaLabel={strings.sectionAriaLabel}
        options={[
          { value: "", label: strings.allSections },
          { value: "listening", label: sections.listening },
          { value: "reading", label: sections.reading },
          { value: "writing", label: sections.writing },
          { value: "speaking", label: sections.speaking },
        ]}
        value={section}
        onChange={(value) => onSectionChange(String(value))}
        searchable={false}
        className="status-filter-select"
      />
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
      <label className="inline-check">
        <input type="checkbox" checked={mine} onChange={(event) => onMineChange(event.target.checked)} /> {strings.myBanks}
      </label>
      <Button type="submit" size="sm">
        {strings.search}
      </Button>
    </form>
  );
}
