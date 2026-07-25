import type { HTMLAttributes } from "react";
import "./Badge.css";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className = "", children, ...rest }: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`} {...rest}>
      {children}
    </span>
  );
}
