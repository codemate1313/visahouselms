import { createElement, type HTMLAttributes } from "react";
import "./Card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "article" | "section" | "form";
  interactive?: boolean;
  padded?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "surface" | "muted";
}

export function Card({
  as = "div",
  interactive = false,
  padded = true,
  size = "md",
  tone = "surface",
  className = "",
  children,
  ...rest
}: CardProps) {
  const classes = [
    "ui-card",
    padded ? "ui-card-padded" : "",
    `ui-card-${size}`,
    `ui-card-${tone}`,
    interactive ? "ui-card-interactive" : "",
    className,
  ].filter(Boolean).join(" ");

  return createElement(as, { className: classes, ...rest }, children);
}
