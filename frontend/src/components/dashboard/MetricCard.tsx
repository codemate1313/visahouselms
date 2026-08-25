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
  /**
   * Real chronological data points (e.g. monthly totals) to draw the footer
   * sparkline from. Omit when no genuine trend history exists for this metric -
   * the sparkline is intentionally not shown rather than faked, so there is no
   * "flat placeholder" variant to fall back to.
   */
  sparklineData?: number[];
  tone?: MetricCardTone;
  valueClassName?: string;
  valueFormatter?: (value: number) => string;
}

const SPARKLINE_WIDTH = 82;
const SPARKLINE_HEIGHT = 32;
const SPARKLINE_PADDING_Y = 4;

function Sparkline({ tone, points }: { tone: MetricCardTone; points: number[] }) {
  const stroke = tone === "amber" ? "#f59e0b" : tone === "blue" ? "#3b82f6" : tone === "purple" ? "#8b5cf6" : "#10b981";

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = SPARKLINE_WIDTH / (points.length - 1);
  const usableHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING_Y * 2;

  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = SPARKLINE_PADDING_Y + usableHeight - ((value - min) / range) * usableHeight;
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT} L0 ${SPARKLINE_HEIGHT} Z`;

  return (
    <svg className="metric-sparkline" width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} fill="none" aria-hidden="true">
      <path d={linePath} stroke={stroke} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={areaPath} fill={stroke} opacity="0.08" />
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
  sparklineData,
  tone = "green",
  valueClassName = "",
  valueFormatter,
}: MetricCardProps) {
  const normalizedTone: MetricCardTone = tone === "primary" ? "green" : tone === "emerald" ? "green" : tone;
  const isInteractive = Boolean(onClick);
  const content = typeof value === "number"
    ? <AnimatedCounter value={value} duration={1200} format={valueFormatter} />
    : value;
  const hasSparkline = Boolean(sparklineData && sparklineData.length >= 2);

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

      {(badge || caption || children || hasSparkline) && (
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
          {hasSparkline && <Sparkline tone={normalizedTone} points={sparklineData as number[]} />}
        </div>
      )}
    </div>
  );
}
