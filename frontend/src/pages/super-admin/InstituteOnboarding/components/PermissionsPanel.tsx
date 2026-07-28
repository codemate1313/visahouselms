import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon } from "@/components/icons";
import { Checkbox } from "@/components/ui";
import { getPermissionIcon } from "@/pages/super-admin/permissionIcons";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { PERMISSIONS } from "../helpers";

interface PermissionsPanelProps {
  adminPermissions: Record<string, boolean>;
  onTogglePermission: (key: string, checked: boolean) => void;
  onToggleAll: () => void;
}

export function PermissionsPanel({ adminPermissions, onTogglePermission, onToggleAll }: PermissionsPanelProps) {
  const t = strings.step1.permissions;
  const allChecked = PERMISSIONS.every((permission) => adminPermissions[permission.key]);
  const someChecked = PERMISSIONS.some((permission) => adminPermissions[permission.key]);

  return (
    <CollapsiblePanel
      className="form-card onboarding-section-card"
      title={t.title}
      description={t.description}
      badge={<span className="count-chip">{Object.values(adminPermissions).filter(Boolean).length}</span>}
    >
      <div className="permission-grid">
        <label className="permission-option select-all-option">
          <span className="permission-option-icon" aria-hidden="true">
            <Icon name={getPermissionIcon("select_all")} />
          </span>
          <span className="permission-option-copy">
            <strong>{t.selectAll}</strong>
          </span>
          <Checkbox
            className="permission-state-checkbox"
            checked={allChecked}
            indeterminate={someChecked && !allChecked}
            onChange={onToggleAll}
          />
        </label>
        {PERMISSIONS.map((permission) => (
          <label className="permission-option" key={permission.key}>
            <span className="permission-option-icon" aria-hidden="true">
              <Icon name={getPermissionIcon(permission.key)} />
            </span>
            <span className="permission-option-copy">
              <strong>{permission.label}</strong>
              <small>{permission.description}</small>
            </span>
            <Checkbox
              className="permission-state-checkbox"
              checked={Boolean(adminPermissions[permission.key])}
              onChange={(event) => onTogglePermission(permission.key, event.target.checked)}
            />
          </label>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
