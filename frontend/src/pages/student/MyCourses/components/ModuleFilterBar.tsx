import { SearchInput, SegmentedControl } from "@/components/ui";
import { myCoursesStrings as strings } from "../MyCourses.strings";

interface ModuleFilterBarProps {
  availableTypes: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  typeCounts?: Record<string, number>;
}

export function ModuleFilterBar({
  availableTypes,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
  typeCounts = {},
}: ModuleFilterBarProps) {
  const typeLabels = strings.moduleTypeLabels;
  const filterOptions = ["ALL", ...availableTypes];

  return (
    <div className="assigned-tests-filter-bar">
      <SegmentedControl
        ariaLabel="Module type filter"
        onChange={onTypeFilterChange}
        options={filterOptions.map((type) => {
          const labelText = type === "ALL" ? strings.all : (typeLabels[type as keyof typeof typeLabels] ?? type);
          const count = typeCounts[type];
          return {
            label: (
              <span className="segmented-tab-label">
                <span>{labelText}</span>
                {count !== undefined && count > 0 && (
                  <span className="segmented-tab-count">{count}</span>
                )}
              </span>
            ),
            value: type,
          };
        })}
        value={typeFilter}
      />
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={strings.searchPlaceholder}
        width={320}
      />
    </div>
  );
}
