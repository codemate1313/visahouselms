import type { FormEvent } from "react";
import type { ModuleBlueprint } from "@/api/types";
import { Button, SearchInput, SearchableSelect } from "@/components/ui";
import { modulesStrings as strings } from "../Modules.strings";

interface ModuleFilterBarProps {
  blueprints: ModuleBlueprint[];
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function ModuleFilterBar({
  blueprints,
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  onSubmit,
}: ModuleFilterBarProps) {
  return (
    <form className="filter-bar responsive-filters" onSubmit={onSubmit}>
      <SearchInput
        aria-label={strings.searchAriaLabel}
        placeholder={strings.searchPlaceholder}
        value={search}
        onChange={onSearchChange}
      />
      <SearchableSelect
        ariaLabel={strings.typeFilter.ariaLabel}
        options={[{ value: "", label: strings.typeFilter.all }, ...blueprints.map((item) => ({ value: item.module_type, label: item.label }))]}
        value={type}
        onChange={(value) => onTypeChange(String(value))}
        searchable={false}
        className="status-filter-select"
      />
      <SearchableSelect
        ariaLabel={strings.statusFilter.ariaLabel}
        options={[
          { value: "", label: strings.statusFilter.all },
          { value: "draft", label: strings.statusFilter.draft },
          { value: "published", label: strings.statusFilter.published },
          { value: "archived", label: strings.statusFilter.archived },
        ]}
        value={status}
        onChange={(value) => onStatusChange(String(value))}
        searchable={false}
        className="status-filter-select"
      />
      <Button type="submit">{strings.search}</Button>
    </form>
  );
}
