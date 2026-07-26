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
  color = "var(--primary, #e11d2e)",
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
  const gridMax = maximum < 10 ? Math.max(1, maximum) : Math.ceil(maximum * 1.15);

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

  // SVG viewBox geometry: 500 x 240
  const width = 500;
  const height = 240;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate coordinates for points
  const points = rows.map((r, i) => {
    const x = rows.length === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (i / (rows.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (gridMax > 0 ? (r.value / gridMax) * chartHeight : 0);
    return { x, y, label: r.label, value: r.value, item: r };
  });

  // Smooth Bezier path generator
  function createDPath(pts: typeof points): string {
    if (!pts.length) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

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
  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : "";

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => (gridMax / (tickCount - 1)) * i);

  return (
    <section className="chart-card reference-styled-chart" aria-label={ariaLabel}>
      {/* Top Header Bar */}
      <div className="chart-card-toolbar">
        <div className="chart-title-area">
          <span className="info-icon-badge"><Icon name="analytics" /></span>
          <span className="chart-tag-text">{title}</span>
        </div>

        {/* Reference Toggle Pill Control (≡ / 田) */}
        <div className="chart-view-toggle-pill">
          <button
            type="button"
            className={`pill-btn ${!showTable ? "active" : ""}`}
            onClick={() => setShowTable(false)}
            title="Graph View"
          >
            &equiv;
          </button>
          <button
            type="button"
            className={`pill-btn ${showTable ? "active" : ""}`}
            onClick={() => setShowTable(true)}
            title="Table View"
          >
            &#9638;
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
              <linearGradient id="lineChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal Lines & Ticks */}
            {ticks.map((val, idx) => {
              const y = paddingTop + chartHeight - (gridMax > 0 ? (val / gridMax) * chartHeight : 0);
              return (
                <g key={idx}>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--border, #e2e8f0)" strokeDasharray="3 3" opacity="0.6" />
                  <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted, #64748b)">
                    {formatValue(val)}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill="url(#lineChartGradient)" />}

            {/* Line Path */}
            {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Data Dots & Interactive Points */}
            {points.map((pt, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: "pointer" }}>
                  <circle cx={pt.x} cy={pt.y} r={isHovered ? 6 : 4} fill={isHovered ? "#ffffff" : color} stroke={color} strokeWidth={isHovered ? 3 : 2} />
                  {/* X Axis Label */}
                  <text x={pt.x} y={height - 12} textAnchor="middle" fontSize="11" fill="var(--text-muted, #64748b)">
                    {pt.label.length > 12 ? `${pt.label.slice(0, 10)}…` : pt.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <div
              className="line-chart-tooltip"
              style={{
                position: "absolute",
                left: `${(points[hoveredIndex].x / width) * 100}%`,
                top: `${(points[hoveredIndex].y / height) * 100}%`,
                transform: "translate(-50%, -125%)",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #cbd5e1)",
                borderRadius: "8px",
                padding: "6px 12px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                pointerEvents: "none",
                zIndex: 10,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text, #0f172a)",
                whiteSpace: "nowrap",
              }}
            >
              <div>{points[hoveredIndex].label}</div>
              <div style={{ color: "var(--primary, #e11d2e)" }}>{formatValue(points[hoveredIndex].value)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
