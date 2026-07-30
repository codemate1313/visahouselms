import { SearchInput, SegmentedControl } from "@/components/ui";
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
      <SegmentedControl
        ariaLabel="Module type"
        onChange={onTypeFilterChange}
        options={[
          { label: strings.all, value: "ALL" },
          ...availableTypes.map((value) => ({
            label: typeLabels[value as keyof typeof typeLabels] ?? value,
            value,
          })),
        ]}
        value={typeFilter}
      />
      <SearchInput value={search} onChange={onSearchChange} placeholder={strings.searchPlaceholder} width={320} />
    </div>
  );
}
