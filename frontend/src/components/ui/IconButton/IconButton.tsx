import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.css";

export type IconButtonVariant = "plain" | "outline" | "solid" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> {
  /** The glyph to render. Sized by the component, so pass the raw icon. */
  icon: ReactNode;
  /**
   * Required: an icon alone has no accessible name. Also drives the hover
   * tooltip via `data-tooltip`, matching the existing dashboard convention.
   */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Set false for icons whose meaning is already stated in adjacent text. */
  showTooltip?: boolean;
  type?: "button" | "submit" | "reset";
}

/**
 * Square, icon-only button — the shape behind close buttons, row actions and
 * toolbar controls that were previously hand-rolled per page (`.close-btn`,
 * `.modal-close-btn`, `.action-btn-icon`, `.export-btn`, …).
 *
 * `label` is mandatory because every one of those hand-rolled variants was an
 * unlabelled `<button>` containing only an `<svg>`, which screen readers
 * announce as just "button".
 */
export function IconButton({
  icon,
  label,
  variant = "plain",
  size = "md",
  showTooltip = true,
  className = "",
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = ["ui-icon-btn", `ui-icon-btn-${variant}`, `ui-icon-btn-${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      data-tooltip={showTooltip ? label : undefined}
      {...rest}
    >
      {icon}
    </button>
  );
}
