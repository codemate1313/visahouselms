import { SearchableSelect } from "@/components/ui";
import { logsStrings as strings } from "../Logs.strings";
import type { LogType } from "../types";

interface LogsFilterBarProps {
  tab: LogType;
  search: string;
  onSearchChange: (value: string) => void;
  level: string;
  onLevelChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}

export function LogsFilterBar({ tab, search, onSearchChange, level, onLevelChange, dateFrom, onDateFromChange, dateTo, onDateToChange }: LogsFilterBarProps) {
  const t = strings.levelFilter;
  return (
    <div className="filter-bar">
      <input placeholder={strings.searchPlaceholder} value={search} onChange={(e) => onSearchChange(e.target.value)} />
      {tab === "error" && (
        <SearchableSelect
          options={[
            { value: "", label: t.allLevels },
            { value: "ERROR", label: t.error },
            { value: "WARNING", label: t.warning },
            { value: "CRITICAL", label: t.critical },
          ]}
          value={level}
          onChange={(value) => onLevelChange(String(value))}
          searchable={false}
          className="status-filter-select"
        />
      )}
      <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
      <span className="hint">{strings.dateSeparator}</span>
      <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
    </div>
  );
}
