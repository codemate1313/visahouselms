import { Icon } from "@/components/icons";
import { Checkbox } from "@/components/ui";
import { getPermissionIcon } from "@/pages/super-admin/permissionIcons";
import { instituteFormStrings as strings } from "../InstituteForm.strings";
import type { InstitutePermissions } from "../types";

interface PermissionsFieldsetProps {
  permissions: InstitutePermissions;
  onPermissionsChange: (permissions: InstitutePermissions) => void;
}

export function PermissionsFieldset({ permissions, onPermissionsChange }: PermissionsFieldsetProps) {
  const t = strings.permissions;
  const options = strings.permissionOptions;
  const allChecked = options.every((option) => permissions[option.key]);
  const someChecked = options.some((option) => permissions[option.key]);

  return (
    <fieldset className="permission-fieldset">
      <legend>{t.legend}</legend>
      <p className="hint">{t.description}</p>
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
            onChange={(event) => onPermissionsChange(Object.fromEntries(options.map((option) => [option.key, event.target.checked])) as InstitutePermissions)}
          />
        </label>
        {options.map((option) => (
          <label className="permission-option" key={option.key}>
            <span className="permission-option-icon" aria-hidden="true">
              <Icon name={getPermissionIcon(option.key)} />
            </span>
            <span className="permission-option-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
            <Checkbox
              className="permission-state-checkbox"
              checked={permissions[option.key]}
              onChange={(event) =>
                onPermissionsChange({
                  ...permissions,
                  [option.key]: event.target.checked,
                })
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
