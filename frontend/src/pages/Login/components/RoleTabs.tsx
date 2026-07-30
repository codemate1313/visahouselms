import { SegmentedControl } from "@/components/ui";
import type { RoleOption } from "../types";

interface RoleTabsProps {
  options: readonly RoleOption[];
  selectedRole: string;
  onSelect: (role: string) => void;
}

export function RoleTabs({ options, selectedRole, onSelect }: RoleTabsProps) {
  return (
    <SegmentedControl
      ariaLabel="Account role"
      className="login-role-selector"
      fullWidth
      onChange={onSelect}
      options={options.map((option) => ({
        label: option.label,
        value: option.role,
      }))}
      value={selectedRole}
    />
  );
}
