import type { HTMLAttributes } from "react";

/**
 * Semantic tones plus the legacy colour names that used to be written as raw
 * `.badge badge-*` spans, so every capsule in the app renders through this one
 * component and one stylesheet.
 */
export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "inactive"
  | "gray"
  | "green"
  | "amber"
  | "red"
  | "blue";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge-gray",
  gray: "badge-gray",
  success: "badge-green",
  green: "badge-green",
  warning: "badge-amber",
  amber: "badge-amber",
  danger: "badge-red",
  red: "badge-red",
  info: "badge-blue",
  blue: "badge-blue",
  inactive: "badge-inactive",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className = "", children, ...rest }: BadgeProps) {
  const classes = ["badge", TONE_CLASS[tone] ?? TONE_CLASS.neutral, className].filter(Boolean).join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
