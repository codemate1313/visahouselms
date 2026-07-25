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
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked && !allChecked;
            }}
            onChange={(event) => onPermissionsChange(Object.fromEntries(options.map((option) => [option.key, event.target.checked])) as InstitutePermissions)}
          />
          <span>
            <strong>{t.selectAll}</strong>
          </span>
        </label>
        {options.map((option) => (
          <label className="permission-option" key={option.key}>
            <input
              type="checkbox"
              checked={permissions[option.key]}
              onChange={(event) =>
                onPermissionsChange({
                  ...permissions,
                  [option.key]: event.target.checked,
                })
              }
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
