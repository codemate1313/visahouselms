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
      <span className="toggle-thumb">
        {checked ? (
          <svg className="toggle-icon icon-on" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5 6 5 8.5 9.5 3.5" />
          </svg>
        ) : (
          <svg className="toggle-icon icon-off" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="3" x2="9" y2="9" />
            <line x1="9" y1="3" x2="3" y2="9" />
          </svg>
        )}
      </span>
    </button>
  );
}
