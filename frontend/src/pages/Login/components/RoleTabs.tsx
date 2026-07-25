import type { RoleOption } from "../types";

interface RoleTabsProps {
  options: readonly RoleOption[];
  selectedRole: string;
  onSelect: (role: string) => void;
}

export function RoleTabs({ options, selectedRole, onSelect }: RoleTabsProps) {
  const activeIndex = options.findIndex((opt) => opt.role === selectedRole);
  const totalTabs = options.length || 1;
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="login-role-tabs-bar" role="tablist" style={{ display: "grid", gridTemplateColumns: `repeat(${totalTabs}, 1fr)` }}>
      <div
        className="role-tab-indicator"
        style={{
          width: `calc((100% - 8px) / ${totalTabs})`,
          transform: `translateX(calc(${safeActiveIndex} * (100% - 2px)))`,
        }}
      />
      {options.map((option) => {
        const isActive = option.role === selectedRole;
        return (
          <button key={option.role} type="button" role="tab" aria-selected={isActive} className={`role-tab-btn ${isActive ? "active" : ""}`} onClick={() => onSelect(option.role)}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
