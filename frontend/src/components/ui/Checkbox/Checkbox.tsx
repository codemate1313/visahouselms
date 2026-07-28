import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from "react";
import "./Checkbox.css";

export type CheckboxSize = "sm" | "md" | "lg";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  size?: CheckboxSize;
  /** Renders the dash (partial-selection) state. Independent of `checked`. */
  indeterminate?: boolean;
}

/**
 * Drop-in replacement for `<input type="checkbox">` with an animated,
 * stroke-draw checkmark. The native input stays in the DOM (visually
 * hidden) so focus, keyboard toggling and form semantics are unchanged —
 * only the box/checkmark are custom-rendered.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = "md", indeterminate = false, disabled, className = "", ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const wrapClasses = ["ui-checkbox", `ui-checkbox-${size}`, className].filter(Boolean).join(" ");

  return (
    <span className={wrapClasses}>
      <input ref={setRefs} type="checkbox" disabled={disabled} className="ui-checkbox-input" {...rest} />
      <span className="ui-checkbox-box" aria-hidden="true">
        <svg className="ui-checkbox-icon" viewBox="0 0 24 24" fill="none">
          <path className="ui-checkbox-check" d="M4.5 12.5L9.5 17.5L19.5 6.5" pathLength={1} />
          <line className="ui-checkbox-dash" x1="6" y1="12" x2="18" y2="12" pathLength={1} />
        </svg>
      </span>
    </span>
  );
});
