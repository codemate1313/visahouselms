import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Icon, type IconName } from "@/components/icons";
import { formatMoney } from "../helpers";
import type { MetricKey } from "../types";
import { Sparkline } from "./Sparkline";

interface MetricItemProps {
  label: string;
  numericValue: number;
  badgeText?: string;
  badgeTheme?: "green" | "blue" | "amber" | "purple" | "slate";
  isCurrency?: boolean;
  valueClassName?: string;
  metricKey: MetricKey;
  iconName: IconName;
  onOpen: (metric: MetricKey) => void;
}

export function MetricItem({
  label,
  numericValue,
  badgeText,
  badgeTheme = "green",
  isCurrency = false,
  valueClassName = "",
  metricKey,
  iconName,
  onOpen,
}: MetricItemProps) {
  return (
    <div
      className={`metric-card theme-${badgeTheme}`}
      onClick={() => onOpen(metricKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(metricKey);
        }
      }}
    >
      <div className="metric-card-header-row">
        <span className="metric-card-label">{label}</span>
        <div className={`metric-card-icon-bubble icon-bg-${badgeTheme}`}>
          <Icon name={iconName} className="metric-card-icon" />
        </div>
      </div>

      <div className="metric-card-value-row">
        <span className={`metric-card-number${valueClassName ? ` ${valueClassName}` : ""}`}>
          <AnimatedCounter value={numericValue} duration={1200} format={isCurrency ? formatMoney : undefined} />
        </span>
      </div>

      <div className="metric-card-footer-row">
        {badgeText && (
          <span className={`metric-badge-pill pill-${badgeTheme}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="metric-pill-arrow">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            {badgeText}
          </span>
        )}
        <Sparkline theme={badgeTheme} />
      </div>
    </div>
  );
}
