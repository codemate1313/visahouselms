import type { FormEvent } from "react";
import { SearchableSelect } from "@/components/ui";
import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "../CourseAssignments.strings";
import type { Institute } from "../types";

interface AssignInstituteFormProps {
  course: Course;
  available: Institute[];
  selected: string;
  onSelectedChange: (value: string) => void;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function AssignInstituteForm({ course, available, selected, onSelectedChange, saving, onSubmit }: AssignInstituteFormProps) {
  const t = strings.assignForm;
  return (
    <section className="workspace-panel">
      <h2>{t.heading}</h2>
      {course.status !== "published" ? (
        <div className="banner warning">{t.publishFirst}</div>
      ) : (
        <form onSubmit={onSubmit}>
          <label htmlFor="institute">{t.instituteLabel}</label>
          <SearchableSelect
            options={available.map((inst) => ({ value: inst.id, label: `${inst.name} (${inst.subscription_state})` }))}
            value={selected}
            onChange={(val) => onSelectedChange(String(val))}
            placeholder={t.selectPlaceholder}
            searchPlaceholder={t.searchPlaceholder}
            disabled={saving}
          />
          <button className="top-gap" disabled={saving || !selected}>
            {saving ? t.assigning : t.grantAccess}
          </button>
        </form>
      )}
    </section>
  );
}
