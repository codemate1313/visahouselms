import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import "./Radio.css";

export type RadioSize = "sm" | "md" | "lg";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  card?: boolean;
  description?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  size?: RadioSize;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { card = false, className = "", description, icon, label, size = "md", ...rest },
  ref,
) {
  const classes = ["ui-radio", `ui-radio-${size}`, card ? "ui-radio-card" : "", className].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <input ref={ref} className="ui-radio-input" type="radio" {...rest} />
      {icon && <span className="ui-radio-icon">{icon}</span>}
      <span className="ui-radio-copy">
        <span className="ui-radio-label">{label}</span>
        {description && <span className="ui-radio-description">{description}</span>}
      </span>
      <span className="ui-radio-mark" aria-hidden="true" />
    </label>
  );
});
