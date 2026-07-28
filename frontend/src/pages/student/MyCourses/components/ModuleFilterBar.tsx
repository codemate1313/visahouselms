import { SearchInput } from "@/components/ui";
import { myCoursesStrings as strings } from "../MyCourses.strings";

interface ModuleFilterBarProps {
  availableTypes: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ModuleFilterBar({ availableTypes, typeFilter, onTypeFilterChange, search, onSearchChange }: ModuleFilterBarProps) {
  const typeLabels = strings.moduleTypeLabels;
  return (
    <div className="assigned-tests-filter-bar">
      <div className="tab-bar">
        <button
          type="button"
          className={`tab ${typeFilter === "ALL" ? "active" : ""}`}
          onClick={() => onTypeFilterChange("ALL")}
        >
          {strings.all}
        </button>
        {availableTypes.map((type) => (
          <button
            key={type}
            type="button"
            className={`tab ${typeFilter === type ? "active" : ""}`}
            onClick={() => onTypeFilterChange(type)}
          >
            {typeLabels[type as keyof typeof typeLabels] ?? type}
          </button>
        ))}
      </div>
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={320} />
    </div>
  );
}
