import type { FormEvent } from "react";
import { SearchableSelect } from "@/components/ui";
import { moduleControlStrings as strings } from "../ModuleControl.strings";

interface ModuleFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function ModuleFilterBar({ search, onSearchChange, status, onStatusChange, onSubmit }: ModuleFilterBarProps) {
  const t = strings.statusOptions;
  return (
    <form className="filter-bar course-filter-bar" onSubmit={onSubmit}>
      <div className="search-input-wrapper">
        <input placeholder={strings.searchPlaceholder} value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </div>
      <SearchableSelect
        options={[
          { value: "", label: t.allStatuses },
          { value: "draft", label: t.draft },
          { value: "published", label: t.published },
          { value: "archived", label: t.archived },
        ]}
        value={status}
        onChange={(val) => onStatusChange(String(val))}
        placeholder={t.allStatuses}
        searchable={false}
        className="status-filter-select"
      />
      <button type="submit" className="filter-search-btn">
        {strings.search}
      </button>
    </form>
  );
}
