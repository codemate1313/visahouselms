import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "small";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  isLoading?: boolean;
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
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const effectiveVariant = variant === "outline" ? "ghost" : variant;
  const effectiveSize = size === "small" ? "sm" : size;
  const busy = loading || isLoading;
  const classes = [
    "ui-btn",
    `ui-btn-${effectiveVariant}`,
    `ui-btn-${effectiveSize}`,
    fullWidth ? "ui-btn-full" : "",
    busy ? "ui-btn-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled || busy} {...rest}>
      {busy && <span className="ui-btn-spinner" aria-hidden="true" />}
      {!busy && leftIcon && <span className="ui-btn-icon ui-btn-icon-left">{leftIcon}</span>}
      <span className="ui-btn-label">{children}</span>
      {!busy && rightIcon && <span className="ui-btn-icon ui-btn-icon-right">{rightIcon}</span>}
    </button>
  );
}
