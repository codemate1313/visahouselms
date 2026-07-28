import type { FormEvent } from "react";
import { SearchableSelect } from "@/components/ui";
import { moduleControlStrings as strings } from "../ModuleControl.strings";
import { ALL_STATUSES_LABEL, EXAM_MODULE_STATUS_OPTIONS } from "@/constants";

interface ModuleFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function ModuleFilterBar({ search, onSearchChange, status, onStatusChange, onSubmit }: ModuleFilterBarProps) {
  return (
    <form className="filter-bar course-filter-bar" onSubmit={onSubmit}>
      <div className="search-input-wrapper">
        <input placeholder={strings.searchPlaceholder} value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </div>
      <SearchableSelect
        options={[
          ...EXAM_MODULE_STATUS_OPTIONS,
        ]}
        value={status}
        onChange={(val) => onStatusChange(String(val))}
        placeholder={ALL_STATUSES_LABEL}
        searchable={false}
        className="status-filter-select"
      />
      <button type="submit" className="filter-search-btn">
        {strings.search}
      </button>
    </form>
  );
}
