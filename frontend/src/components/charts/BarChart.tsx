
import { useState } from "react";
import { Icon } from "../icons";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
  subtext?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  title: string;
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

const BAR_PALETTE = [
  "#e11d2e", // Primary Red
  "#3b82f6", // Royal Blue
  "#10b981", // Emerald Green
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#6366f1", // Indigo
];

export function BarChart({
  data,
  title,
  orientation: _orientation = "vertical",
  color: _color = "#e11d2e",
  legend,
  formatValue = (value) => value.toLocaleString("en-IN"),
  ariaLabel,
  emptyMessage = "No data available.",
}: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const rows = data.map((item) => ({
    ...item,
    value: safeValue(item.value),
  }));

  const maximum = Math.max(0, ...rows.map((item) => item.value));
  const gridMax = maximum < 10 ? Math.max(1, maximum) : Math.ceil(maximum * 1.2);

  if (!rows.length || maximum === 0) {
    return (
      <div className="chart-card chart-empty" role="status">
        <div className="chart-title-area">
          <span className="info-icon-badge"><Icon name="analytics" /></span>
          <span className="chart-tag-text">{title}</span>
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // SVG Geometry: 520 x 240
  const width = 520;
  const height = 240;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 35;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const count = rows.length;
  // Capped bar width to prevent massive thick blocks when count is 1 or 2
  const maxBarWidth = 42;
  const calculatedWidth = Math.max(20, Math.floor(chartWidth / count - 20));
  const barWidth = Math.min(maxBarWidth, calculatedWidth);
  const totalBarsWidth = barWidth * count;
  const remainingSpace = chartWidth - totalBarsWidth;
  const gap = count > 1 ? remainingSpace / (count + 1) : remainingSpace / 2;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => (gridMax / (tickCount - 1)) * i);

  return (
    <section className="chart-card reference-styled-chart" aria-label={ariaLabel}>
      <div className="chart-card-toolbar">
        <div className="chart-title-area">
          <span className="info-icon-badge"><Icon name="analytics" /></span>
          <span className="chart-tag-text">{title}</span>
        </div>

        <div className="chart-view-toggle-pill">
          <button
            type="button"
            className={`pill-btn ${!showTable ? "active" : ""}`}
            onClick={() => setShowTable(false)}
            title="Bar View"
          >
            {"≡"}
          </button>
          <button
            type="button"
            className={`pill-btn ${showTable ? "active" : ""}`}
            onClick={() => setShowTable(true)}
            title="Table View"
          >
            {"田"}
          </button>
        </div>
      </div>

      {legend && legend.length > 0 && (
        <div className="chart-legend-row" style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
          {legend.map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--chart-text, #475569)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      )}

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
                  <td>{maximum > 0 ? `${Math.round((item.value / maximum) * 100)}%` : "0%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bar-chart-container" style={{ position: "relative", width: "100%" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="bar-chart-svg" style={{ width: "100%", height: "auto" }}>
            <defs>
              <linearGradient id="barGradPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d2e" />
                <stop offset="100%" stopColor="#b91323" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Ticks */}
            {ticks.map((val, idx) => {
              const y = paddingTop + chartHeight - (gridMax > 0 ? (val / gridMax) * chartHeight : 0);
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--border-subtle, rgba(148, 163, 184, 0.2))"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 12}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11.5"
                    fontWeight="600"
                    fill="var(--chart-text, #64748b)"
                  >
                    {formatValue(val)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {rows.map((r, i) => {
              const barH = gridMax > 0 ? (r.value / gridMax) * chartHeight : 0;
              const x = paddingLeft + gap + i * (barWidth + (count > 1 ? gap : 0));
              const y = paddingTop + chartHeight - barH;
              const isHovered = hoveredIndex === i;
              const barColor = r.color || BAR_PALETTE[i % BAR_PALETTE.length];

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(2, barH)}
                    rx="6"
                    ry="6"
                    fill={barColor}
                    opacity={isHovered ? 0.9 : 1}
                    className="chart-bar-animated"
                    style={{
                      transformOrigin: `center ${paddingTop + chartHeight}px`,
                      transition: "all 200ms ease",
                    }}
                  />
                  {/* Top Value Badge */}
                  {r.value > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight="800"
                      fill={barColor}
                    >
                      {formatValue(r.value)}
                    </text>
                  )}
                  {/* X Axis Label */}
                  <text
                    x={x + barWidth / 2}
                    y={height - 12}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--chart-text, #64748b)"
                  >
                    {r.label.length > 14 ? `${r.label.slice(0, 12)}…` : r.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Card */}
          {hoveredIndex !== null && rows[hoveredIndex] && (
            <div
              className="bar-chart-tooltip"
              style={{
                position: "absolute",
                left: `${((paddingLeft + gap + hoveredIndex * (barWidth + (count > 1 ? gap : 0)) + barWidth / 2) / width) * 100}%`,
                top: `${((paddingTop + chartHeight - (rows[hoveredIndex].value / gridMax) * chartHeight) / height) * 100}%`,
                transform: "translate(-50%, -130%)",
                background: "var(--tooltip-bg, #0f172a)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "10px",
                padding: "8px 14px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
                pointerEvents: "none",
                zIndex: 20,
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ opacity: 0.8, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {rows[hoveredIndex].label}
              </div>
              <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                {formatValue(rows[hoveredIndex].value)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
