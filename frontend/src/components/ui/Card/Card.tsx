import type { HTMLAttributes } from "react";
import "./Card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ padded = true, className = "", children, ...rest }: CardProps) {
  return (
    <div className={`ui-card ${padded ? "ui-card-padded" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}
