import { useId, type LabelHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import "./Textarea.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  /** Character counter, shown only when `maxLength` is also set. */
  showCount?: boolean;
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
}

/**
 * Multi-line counterpart to `Input`, sharing its field/label/error chrome so
 * the two line up inside the same form grid.
 */
export function Textarea({
  label,
  error,
  id,
  className = "",
  labelProps,
  showCount = false,
  maxLength,
  value,
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const count = typeof value === "string" ? value.length : 0;

  return (
    <div className="ui-field ui-textarea-field">
      {label && (
        <label htmlFor={textareaId} {...labelProps}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`ui-textarea ${error ? "ui-textarea-error" : ""} ${className}`.trim()}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
      <div className="ui-textarea-footer">
        {error ? <span className="ui-field-error">{error}</span> : <span />}
        {showCount && maxLength !== undefined && (
          <span className="ui-textarea-count">
            {count}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
