import { useEffect, useId, useState } from "react";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
  subtext?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  legend?: { label: string; color: string }[];
  formatValue?: (value: number) => string;
  ariaLabel: string;
  emptyMessage?: string;
}

function safeValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function shortLabel(label: string, maximum: number): string {
  return label.length > maximum ? `${label.slice(0, maximum - 1)}…` : label;
}

export function BarChart({
  data,
  orientation = "vertical",
  color,
  legend,
  formatValue = (value) => value.toLocaleString("en-IN"),
  ariaLabel,
  emptyMessage = "No data available.",
}: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const rows = data.map((item) => ({
    ...item,
    value: safeValue(item.value),
  }));

  const maximum = Math.max(0, ...rows.map((item) => item.value));
  // Round up max for nice grid axis ticks
  const gridMax = Math.max(100, Math.ceil((maximum * 1.15) / 100) * 100);

  if (!rows.length || maximum === 0) {
    return <div className="chart-card chart-empty" role="status">{emptyMessage}</div>;
  }

  // Active bar defaults to top value row if none hovered
  const activeIdx = hoveredIndex !== null ? hoveredIndex : 0;

  // Grid tick values (e.g. 0, 2000, 4000, 6000)
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.round((gridMax / (tickCount - 1)) * i));

  return (
    <section className="chart-card reference-styled-chart">
      {/* Top Header Bar */}
      <div className="chart-card-toolbar">
        {legend?.length ? (
          <div className="chart-legend" aria-label="Chart legend">
            {legend.map((item, idx) => (
              <span
                className={`chart-legend-item ${activeIdx === idx ? "legend-active" : ""}`}
                key={item.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <i className="chart-legend-swatch" style={{ background: item.color }} />
                <span className="legend-label-text">{item.label}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="chart-title-area">
            <span className="info-icon-badge">📊</span>
            <span className="chart-tag-text">Analytics Overview</span>
          </div>
        )}

        {/* Reference Toggle Pill Control (≡ / 田) */}
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
                <th>Category</th>
                <th>Value</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{formatValue(item.value)}</td>
                  <td>{Math.round((item.value / maximum) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : orientation === "horizontal" ? (
        /* REFERENCE HORIZONTAL BAR CHART DESIGN */
        <div className="ref-horizontal-chart-wrap">
          {/* Dashed Vertical Background Gridlines */}
          <div className="vertical-gridlines-container">
            {ticks.map((tick) => (
              <div key={tick} className="gridline-col">
                <div className="dashed-line" />
              </div>
            ))}
          </div>

          {/* Bar Rows */}
          <div className="horizontal-bar-list">
            {rows.map((row, idx) => {
              const percent = gridMax > 0 ? (row.value / gridMax) * 100 : 0;
              const isActive = activeIdx === idx;
              // Highlight top item in vibrant red (#e53935), others in soft sage green (#76a77d)
              const barColor = row.color
                ? row.color
                : color
                ? color
                : idx === 0
                ? "#e53935"
                : "#76a77d";

              return (
                <div
                  key={row.label}
                  className={`ref-bar-row ${isActive ? "is-active" : ""}`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Category Name */}
                  <div className="ref-bar-label" title={row.label}>
                    {shortLabel(row.label, 20)}
                  </div>

                  {/* Bar Track & End Callout */}
                  <div className="ref-bar-track">
                    <div
                      className="ref-bar-fill"
                      style={{
                        width: loaded ? `${Math.max(percent, 4)}%` : "0%",
                        background: barColor,
                      }}
                    >
                      {/* Left Circular Ring Start Dot */}
                      <span className="bar-start-ring" style={{ borderColor: barColor }} />

                      {/* Right Pointer Dot for Active Row */}
                      {isActive && <span className="bar-end-dot" style={{ background: "#ffffff", borderColor: barColor }} />}
                    </div>

                    {/* Dark Reference Tooltip Callout Card */}
                    {isActive && (
                      <div className="ref-dark-tooltip-callout">
                        <span className="tooltip-subtext">{row.subtext ?? "Recent Activity"}</span>
                        <strong className="tooltip-main-val">{formatValue(row.value)}</strong>
                        <div className="tooltip-arrow-down" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom X-Axis Ticks (Aligned directly with vertical gridlines) */}
          <div className="ref-x-axis-row">
            <div className="x-axis-indent" />
            <div className="x-axis-ticks">
              {ticks.map((tick) => (
                <span key={tick} className="x-tick-label">
                  {formatValue(tick)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* REFERENCE VERTICAL BAR CHART DESIGN */
        <div className="ref-vertical-chart-wrap">
          <svg className="ref-vertical-svg" viewBox="0 0 500 230" role="img" aria-labelledby={titleId}>
            <title id={titleId}>{ariaLabel}</title>

            {/* Dashed Horizontal Background Gridlines & Y-Axis Ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = 190 - step * 160;
              const val = Math.round(gridMax * step);
              return (
                <g key={step}>
                  <line
                    x1="65"
                    y1={y}
                    x2="480"
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text x="55" y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="500">
                    {formatValue(val)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Bars */}
            {rows.map((row, idx) => {
              const count = rows.length;
              const availableWidth = 400;
              const barWidth = Math.min(36, Math.max(18, Math.floor(availableWidth / count - 16)));
              const gap = (availableWidth - barWidth * count) / (count + 1);
              const x = 70 + gap + idx * (barWidth + gap);
              const barHeight = gridMax > 0 ? (row.value / gridMax) * 160 : 0;
              const y = 190 - (loaded ? barHeight : 0);
              const isActive = activeIdx === idx;
              const barColor = row.color
                ? row.color
                : color
                ? color
                : idx === 0
                ? "#e53935"
                : "#76a77d";

              return (
                <g
                  key={row.label}
                  className={`ref-vbar-group ${isActive ? "is-active" : ""}`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Vertical Bar Rect */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={loaded ? barHeight : 0}
                    rx="8"
                    ry="8"
                    fill={barColor}
                    style={{
                      transition: "all 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                      opacity: hoveredIndex !== null && !isActive ? 0.45 : 1,
                    }}
                  />

                  {/* Start Ring Dot at Base */}
                  <circle cx={x + barWidth / 2} cy="188" r="3" fill="#ffffff" stroke={barColor} strokeWidth="1.5" />

                  {/* End Dot at Top of Active Bar */}
                  {isActive && (
                    <circle cx={x + barWidth / 2} cy={y + 4} r="4" fill="#ffffff" stroke="#e53935" strokeWidth="2" />
                  )}

                  {/* X Axis Label */}
                  <text
                    x={x + barWidth / 2}
                    y="212"
                    textAnchor="middle"
                    fill={isActive ? "#0f172a" : "#64748b"}
                    fontSize="11"
                    fontWeight={isActive ? "700" : "500"}
                  >
                    {shortLabel(row.label, 10)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Dark Floating Tooltip Callout for Vertical Bar */}
          {activeIdx !== null && rows[activeIdx] && (
            <div className="ref-dark-tooltip-callout v-centered">
              <span className="tooltip-subtext">{rows[activeIdx].label}</span>
              <strong className="tooltip-main-val">{formatValue(rows[activeIdx].value)}</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
