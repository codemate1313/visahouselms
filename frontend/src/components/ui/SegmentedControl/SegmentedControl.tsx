import type { ReactNode } from "react";
import "./SegmentedControl.css";

export interface SegmentedOption<T extends string> {
  icon?: ReactNode;
  label: ReactNode;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  ariaLabel?: string;
  className?: string;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = "",
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <div className={`ui-segmented-control${className ? ` ${className}` : ""}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          className={`ui-segmented-option${option.value === value ? " is-active" : ""}`}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <span className="ui-segmented-icon">{option.icon}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
