import { useId, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";
import "./Input.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
}

/**
 * Shared text/number/email field. No fixed width — size it per call site
 * with `style`, `className`, or a wrapping form-grid layout.
 */
export function Input({ label, error, id, className = "", labelProps, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="ui-field">
      {label && (
        <label htmlFor={inputId} {...labelProps}>
          {label}
        </label>
      )}
      <input id={inputId} className={`ui-input ${error ? "ui-input-error" : ""} ${className}`} {...rest} />
      {error && <span className="ui-field-error">{error}</span>}
    </div>
  );
}
