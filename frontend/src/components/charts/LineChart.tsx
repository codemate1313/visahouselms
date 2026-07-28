import { useState } from "react";
import { Icon } from "../icons";
import "./LineChart.css";

export interface LineChartDatum {
  label: string;
  value: number;
  color?: string;
  subtext?: string;
}

interface LineChartProps {
  data: LineChartDatum[];
  title: string;
  color?: string;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  emptyMessage?: string;
}

function safeValue(val: number): number {
  return Number.isFinite(val) ? Math.max(0, val) : 0;
}

export function LineChart({
  data,
  title,
  color = "#e11d2e",
  formatValue = (v) => v.toLocaleString("en-IN"),
  ariaLabel = title,
  emptyMessage = "No data available.",
}: LineChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const rows = data.map((d) => ({
    ...d,
    value: safeValue(d.value),
  }));

  const maximum = Math.max(0, ...rows.map((r) => r.value));
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

  // SVG dimensions
  const width = 520;
  const height = 240;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 35;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Single-point or Multi-point dataset handling
  let points: Array<{ x: number; y: number; label: string; value: number; item: (typeof rows)[0] }> = [];

  if (rows.length === 1) {
    const single = rows[0];
    const yVal = paddingTop + chartHeight - (gridMax > 0 ? (single.value / gridMax) * chartHeight : 0);
    points = [
      { x: paddingLeft + chartWidth * 0.15, y: paddingTop + chartHeight, label: "", value: 0, item: single },
      { x: paddingLeft + chartWidth * 0.5, y: yVal, label: single.label, value: single.value, item: single },
      { x: paddingLeft + chartWidth * 0.85, y: paddingTop + chartHeight, label: "", value: 0, item: single },
    ];
  } else {
    points = rows.map((r, i) => {
      const x = paddingLeft + (i / (rows.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (gridMax > 0 ? (r.value / gridMax) * chartHeight : 0);
      return { x, y, label: r.label, value: r.value, item: r };
    });
  }

  function createDPath(pts: typeof points): string {
    if (!pts.length) return "";
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }

  const pathD = createDPath(points);
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : "";

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => (gridMax / (tickCount - 1)) * i);
  const displayPoints = rows.length === 1 ? [points[1]] : points;

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
            title="Graph View"
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

      {showTable ? (
        <div className="chart-data-table-wrap">
          <table className="chart-data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
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
        <div className="line-chart-container" style={{ position: "relative", width: "100%" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" style={{ width: "100%", height: "auto" }}>
            <defs>
              <linearGradient id={`lineGrad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="70%" stopColor={color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal Lines & Ticks */}
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

            {/* Gradient Area Fill */}
            {areaD && (
              <path
                d={areaD}
                fill={`url(#lineGrad-${title.replace(/\s+/g, '-')})`}
                className="chart-area-animated"
              />
            )}

            {/* Animated Smooth Line Path */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line-animated"
              />
            )}

            {/* Data Dots & X-Axis Labels */}
            {displayPoints.map((pt, i) => {
              const originalIndex = rows.length === 1 ? 0 : i;
              const isHovered = hoveredIndex === originalIndex;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIndex(originalIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 5}
                    fill={isHovered ? "#ffffff" : color}
                    stroke={color}
                    strokeWidth={isHovered ? 3.5 : 2.5}
                    style={{ transition: "all 180ms ease" }}
                  />
                  {pt.label && (
                    <text
                      x={pt.x}
                      y={height - 12}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="var(--chart-text, #64748b)"
                    >
                      {pt.label.length > 14 ? `${pt.label.slice(0, 12)}…` : pt.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Card */}
          {hoveredIndex !== null && rows[hoveredIndex] && (
            <div
              className="line-chart-tooltip"
              style={{
                position: "absolute",
                left: rows.length === 1 ? "50%" : `${(displayPoints[hoveredIndex]?.x ?? 0) / width * 100}%`,
                top: rows.length === 1 ? "35%" : `${(displayPoints[hoveredIndex]?.y ?? 0) / height * 100}%`,
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
