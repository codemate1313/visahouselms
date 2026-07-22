interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  tooltip?: string;
}

export function ToggleSwitch({ checked, onChange, disabled = false, tooltip }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? "active" : ""}`}
      onClick={onChange}
      disabled={disabled}
      data-tooltip={tooltip}
      aria-label={tooltip ?? "Toggle status"}
      aria-pressed={checked}
    >
      <span className="toggle-track-fill" />
      <span className="toggle-thumb" />
    </button>
  );
}
