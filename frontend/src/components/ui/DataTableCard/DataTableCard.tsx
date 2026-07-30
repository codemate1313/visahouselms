import type { HTMLAttributes, ReactNode } from "react";

export interface DataTableCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DataTableCard({ className = "", children, ...rest }: DataTableCardProps) {
  const classes = ["table-wrap", "data-table-card", className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
