import { SearchableSelect } from "@/components/ui";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import type { InstituteRow } from "../types";

interface InstituteSelectorProps {
  institutes: InstituteRow[];
  selected: number | null;
  onSelect: (id: number) => void;
}

export function InstituteSelector({ institutes, selected, onSelect }: InstituteSelectorProps) {
  return (
    <div className="filter-bar institutes-filter-bar" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {strings.instituteLabel}
        </span>
        <div style={{ width: 260 }}>
          <SearchableSelect
            options={institutes.map((inst) => ({
              value: String(inst.id),
              label: inst.name,
            }))}
            value={selected ? String(selected) : ""}
            onChange={(val) => onSelect(Number(val))}
            placeholder={strings.selectInstitute}
            searchPlaceholder={strings.searchInstitutePlaceholder}
          />
        </div>
      </div>
    </div>
  );
}
