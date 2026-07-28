import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  type?: "button" | "submit" | "reset";
}

/**
 * Shared button primitive. Width is never fixed here — pass `fullWidth`,
 * a `style={{ width }}`, or a layout `className` at the call site to size
 * it for wherever it's placed (toolbar action vs. full-width form submit).
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "ui-btn",
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    fullWidth ? "ui-btn-full" : "",
    loading ? "ui-btn-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="ui-btn-spinner" aria-hidden="true" />}
      {!loading && leftIcon && <span className="ui-btn-icon ui-btn-icon-left">{leftIcon}</span>}
      <span className="ui-btn-label">{children}</span>
      {!loading && rightIcon && <span className="ui-btn-icon ui-btn-icon-right">{rightIcon}</span>}
    </button>
  );
}
