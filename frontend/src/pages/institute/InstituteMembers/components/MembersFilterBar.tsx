import { SearchableSelect, SearchInput } from "@/components/ui";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";

interface MembersFilterBarProps {
  label: string;
  isAllAccounts: boolean;
  /** Access states only exist for students, so the extra options are hidden
   *  on the staff roster where they would never match anything. */
  showAccessStates?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  activityFilter: string;
  onActivityFilterChange: (value: string) => void;
  sessionFilter: string;
  onSessionFilterChange: (value: string) => void;
}

export function MembersFilterBar({
  label,
  isAllAccounts,
  showAccessStates = false,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  activityFilter,
  onActivityFilterChange,
  sessionFilter,
  onSessionFilterChange,
}: MembersFilterBarProps) {
  const f = strings.filters;
  return (
    <div className={`filter-row ${isAllAccounts ? "accounts-filter-row" : ""}`}>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={strings.searchPlaceholder(label)}
        width={260}
      />
      {isAllAccounts && (
        <SearchableSelect
          options={[
            { value: "", label: f.accountType.placeholder },
            { value: "STUDENT", label: f.accountType.student },
            { value: "INST_INSTRUCTOR", label: f.accountType.instructor },
          ]}
          value={roleFilter}
          onChange={(value) => onRoleFilterChange(String(value))}
          searchable={false}
          className="member-filter-select"
        />
      )}
      <SearchableSelect
        options={[
          { value: "", label: f.status.placeholder },
          { value: "active", label: f.status.active },
          { value: "inactive", label: f.status.inactive },
          ...(showAccessStates
            ? [
                { value: "expired", label: f.status.expired },
                { value: "reclaimable", label: f.status.reclaimable },
                { value: "released", label: f.status.released },
              ]
            : []),
          { value: "deleted", label: f.status.deleted },
          { value: "password_reset", label: f.status.passwordResetPending },
        ]}
        value={statusFilter}
        onChange={(value) => onStatusFilterChange(String(value))}
        searchable={false}
        className="member-filter-select"
      />
      <SearchableSelect
        options={[
          { value: "", label: f.activity.placeholder },
          { value: "attempts", label: f.activity.hasAttempts },
          { value: "no_attempts", label: f.activity.noAttempts },
        ]}
        value={activityFilter}
        onChange={(value) => onActivityFilterChange(String(value))}
        searchable={false}
        className="member-filter-select"
      />
      <SearchableSelect
        options={[
          { value: "", label: f.session.placeholder },
          { value: "active_session", label: f.session.activeSession },
          { value: "known_devices", label: f.session.knownDevices },
          { value: "no_devices", label: f.session.noDevices },
        ]}
        value={sessionFilter}
        onChange={(value) => onSessionFilterChange(String(value))}
        searchable={false}
        className="member-filter-select"
      />
    </div>
  );
}
