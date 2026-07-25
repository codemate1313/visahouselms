import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Checkbox } from "@/components/ui";
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
          <Checkbox
            checked={allChecked}
            indeterminate={someChecked && !allChecked}
            onChange={onToggleAll}
          />
          <span>
            <strong>{t.selectAll}</strong>
          </span>
        </label>
        {PERMISSIONS.map((permission) => (
          <label className="permission-option" key={permission.key}>
            <Checkbox
              checked={Boolean(adminPermissions[permission.key])}
              onChange={(event) => onTogglePermission(permission.key, event.target.checked)}
            />
            <span>
              <strong>{permission.label}</strong>
              <small>{permission.description}</small>
            </span>
          </label>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
