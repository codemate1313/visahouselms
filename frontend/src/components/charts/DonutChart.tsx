import { useEffect, useId, useState } from "react";
import { AnimatedCounter } from "../AnimatedCounter";
import { Icon } from "../icons";

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  centerLabel?: string;
  ariaLabel: string;
  emptyMessage?: string;
  cardVariant?: "default" | "tinted";
}

export function DonutChart({
  data,
  centerLabel = "total",
  ariaLabel,
  emptyMessage = "No data available.",
  cardVariant = "tinted",
}: DonutChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const rows = data
    .map((item) => ({ ...item, value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0 }))
    .filter((item) => item.value > 0);
  const total = rows.reduce((sum, item) => sum + item.value, 0);

  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const gapSize = rows.length > 1 ? 8 : 0;
  let consumed = 0;

  if (!rows.length || total === 0) {
    return <div className={`chart-card ${cardVariant === "tinted" ? "tinted-bg" : ""} chart-empty`} role="status">{emptyMessage}</div>;
  }

  const activeItem = hoveredIndex !== null ? rows[hoveredIndex] : null;
  const activePercent = activeItem ? Math.round((activeItem.value / total) * 100) : 0;

  return (
    <section className={`chart-card reference-styled-chart ${cardVariant === "tinted" ? "tinted-bg" : ""}`}>
      <div className="chart-card-toolbar">
        <span className="chart-info-tag">
          <span className="info-dot"><Icon name="analytics" /></span>
          <span>Breakdown</span>
        </span>
        {/* View Toggle Pill Control (≡ / 田) */}
        <div className="chart-view-toggle-pill">
          <button
            type="button"
            className={`pill-btn ${!showTable ? "active" : ""}`}
            onClick={() => setShowTable(false)}
            title="Chart View"
          >
            ≡
          </button>
          <button
            type="button"
            className={`pill-btn ${showTable ? "active" : ""}`}
            onClick={() => setShowTable(true)}
            title="Data Table View"
          >
            田
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="chart-data-table-wrap">
          <table className="chart-data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{item.value.toLocaleString("en-IN")}</td>
                  <td>{Math.round((item.value / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="modern-donut-grid">
          {/* Ring Chart Layout */}
          <div className="donut-layout">
            <svg className="donut-svg 3d-donut-chart" viewBox="0 0 220 220" role="img" aria-labelledby={titleId}>
              <title id={titleId}>{ariaLabel}</title>

              {/* Background Ring Track */}
              <circle
                className="donut-track"
                cx="110"
                cy="110"
                r={radius}
                stroke="#e2e8f0"
                strokeWidth="16"
                fill="none"
              />

              {/* Segment Arcs */}
              {rows.map((item, index) => {
                const rawLength = (circumference * item.value) / total;
                const arcLength = Math.max(0, rawLength - gapSize);
                const currentLength = loaded ? arcLength : 0;
                const offset = -consumed;
                consumed += rawLength;
                const isHovered = hoveredIndex === index;
                const isDimmed = hoveredIndex !== null && !isHovered;

                return (
                  <circle
                    key={item.label}
                    className={`donut-segment ${isHovered ? "segment-active" : ""}`}
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={isHovered ? 20 : 16}
                    strokeLinecap="round"
                    strokeDasharray={`${currentLength} ${circumference - currentLength}`}
                    strokeDashoffset={offset}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                    tabIndex={0}
                    style={{
                      cursor: "pointer",
                      transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 200ms ease, opacity 200ms ease, transform 200ms ease",
                      opacity: isDimmed ? 0.35 : 1,
                      transformOrigin: "center",
                      transform: isHovered ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    <title>{`${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)`}</title>
                  </circle>
                );
              })}

              {/* Center Display */}
              <text className="donut-total" x="110" y="102" textAnchor="middle" style={{ fontSize: "30px", fontWeight: 800, fill: "#0f172a" }}>
                {hoveredIndex !== null ? (
                  activeItem?.value.toLocaleString("en-IN")
                ) : (
                  <AnimatedCounter value={total} duration={1200} />
                )}
              </text>
              <text className="donut-label" x="110" y="124" textAnchor="middle" style={{ fontSize: "11.5px", fontWeight: 600, fill: "#64748b" }}>
                {hoveredIndex !== null ? activeItem?.label : centerLabel}
              </text>
            </svg>
          </div>

          {/* Side Legend & Progress Bar */}
          <div className="donut-side-panel">
            <div className="donut-legend-list">
              {rows.map((item, idx) => (
                <div
                  className={`donut-legend-row ${hoveredIndex === idx ? "row-active" : ""}`}
                  key={item.label}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(idx)}
                  onBlur={() => setHoveredIndex(null)}
                  tabIndex={0}
                >
                  <div className="legend-row-left">
                    <span className="legend-dot-swatch" style={{ background: item.color }} />
                    <span className="legend-row-label">{item.label}</span>
                  </div>
                  <span className="legend-row-value">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Bottom Capsule Progress Indicator */}
            <div className="donut-progress-section">
              <div className="donut-progress-track">
                <div
                  className="donut-progress-bar-fill"
                  style={{
                    width: loaded ? `${activePercent}%` : "0%",
                    background: activeItem?.color ?? "transparent",
                  }}
                >
                  {activeItem && <div className="donut-floating-badge">{activePercent}%</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
