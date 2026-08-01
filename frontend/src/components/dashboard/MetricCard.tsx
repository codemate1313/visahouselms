import type { ReactNode } from "react";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Icon, type IconName } from "@/components/icons";

export type MetricCardTone = "green" | "blue" | "amber" | "purple" | "slate" | "primary" | "emerald";

interface MetricCardProps {
  label: string;
  value: number | string;
  badge?: string;
  caption?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: IconName;
  iconNode?: ReactNode;
  onClick?: () => void;
  tone?: MetricCardTone;
  valueClassName?: string;
  valueFormatter?: (value: number) => string;
}

function Sparkline({ tone }: { tone: MetricCardTone }) {
  const stroke = tone === "amber" ? "#f59e0b" : tone === "blue" ? "#3b82f6" : tone === "purple" ? "#8b5cf6" : "#10b981";
  return (
    <svg className="metric-sparkline" width="82" height="32" viewBox="0 0 82 32" fill="none" aria-hidden="true">
      <path d="M2 25 C13 20 20 22 29 24 C41 27 45 18 55 12 C63 7 70 6 80 8" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <path d="M2 31 C13 26 20 28 29 30 C41 33 45 24 55 18 C63 13 70 12 80 14 L80 32 L2 32 Z" fill={stroke} opacity="0.08" />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  badge,
  caption,
  children,
  className = "",
  icon,
  iconNode,
  onClick,
  tone = "green",
  valueClassName = "",
  valueFormatter,
}: MetricCardProps) {
  const normalizedTone: MetricCardTone = tone === "primary" ? "green" : tone === "emerald" ? "green" : tone;
  const isInteractive = Boolean(onClick);
  const content = typeof value === "number"
    ? <AnimatedCounter value={value} duration={1200} format={valueFormatter} />
    : value;

  return (
    <div
      className={`metric-card theme-${normalizedTone}${isInteractive ? " is-clickable" : ""}${className ? ` ${className}` : ""}`}
      style={{ cursor: isInteractive ? "pointer" : "default" }}
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="metric-card-header-row">
        <span className="metric-card-label">{label}</span>
        {(icon || iconNode) && (
          <div className={`metric-card-icon-bubble icon-bg-${normalizedTone}`}>
            {icon ? <Icon name={icon} className="metric-card-icon" /> : iconNode}
          </div>
        )}
      </div>

      <div className="metric-card-value-row">
        <span className={`metric-card-number${valueClassName ? ` ${valueClassName}` : ""}`}>
          {content}
        </span>
      </div>

      {(badge || caption || children) && (
        <div className="metric-card-footer-row">
          <div className="metric-card-footer-copy">
            {badge && (
              <span className={`metric-badge-pill pill-${normalizedTone}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="metric-pill-arrow">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                {badge}
              </span>
            )}
            {caption && <span className="metric-card-caption">{caption}</span>}
            {children}
          </div>
          {badge && <Sparkline tone={normalizedTone} />}
        </div>
      )}
    </div>
  );
}
