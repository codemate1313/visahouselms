import type { FormEvent } from "react";
import { Button, SearchInput, SearchableSelect } from "@/components/ui";
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
      <SearchInput className="course-filter-search" placeholder={strings.searchPlaceholder} value={search} onChange={onSearchChange} fullWidth />
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
      <Button type="submit" className="filter-search-btn" size="md">
        {strings.search}
      </Button>
    </form>
  );
}
