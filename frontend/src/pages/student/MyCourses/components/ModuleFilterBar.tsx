import { FilterBar, SearchInput, SearchableSelect } from "@/components/ui";
import { myCoursesStrings as strings } from "../MyCourses.strings";

interface ModuleFilterBarProps {
  availableTypes: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  typeCounts?: Record<string, number>;
  statusCounts?: {
    all: number;
    unattempted: number;
    completed: number;
  };
}

export function ModuleFilterBar({
  availableTypes,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  typeCounts = {},
  statusCounts = { all: 0, unattempted: 0, completed: 0 },
}: ModuleFilterBarProps) {
  const typeLabels = strings.moduleTypeLabels;

  const typeOptions = [
    { value: "ALL", label: `All Types (${typeCounts.ALL ?? 0})` },
    ...availableTypes.map((type) => {
      const labelText = typeLabels[type as keyof typeof typeLabels] ?? type;
      const count = typeCounts[type] ?? 0;
      return {
        value: type,
        label: `${labelText} (${count})`,
      };
    }),
  ];

  const statusOptions = [
    { value: "ALL", label: `All Statuses (${statusCounts.all})` },
    { value: "UNATTEMPTED", label: `Unattempted (${statusCounts.unattempted})` },
    { value: "COMPLETED", label: `Completed (${statusCounts.completed})` },
  ];

  return (
    <FilterBar className="assigned-tests-filter-bar">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={strings.searchPlaceholder}
        className="assigned-tests-search-input"
        width={300}
      />
      <SearchableSelect
        ariaLabel="Test type filter"
        options={typeOptions}
        value={typeFilter}
        onChange={(val) => onTypeFilterChange(String(val))}
        placeholder="Filter by type"
        searchable={false}
        className="assigned-tests-type-select"
      />
      <SearchableSelect
        ariaLabel="Attempt status filter"
        options={statusOptions}
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(String(val))}
        placeholder="Filter by status"
        searchable={false}
        className="assigned-tests-status-select"
      />
    </FilterBar>
  );
}
