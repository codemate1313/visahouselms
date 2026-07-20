import { useState } from "react";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  centerLabel?: string;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  ariaLabel: string;
}

const defaultFormat = (v: number) => v.toLocaleString();
const SIZE = 160;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3; // surface-color gap between adjacent slices

export function DonutChart({ data, centerLabel, formatValue = defaultFormat, emptyMessage = "No data yet.", ariaLabel }: DonutChartProps) {
  const [showTable, setShowTable] = useState(false);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cumulative = 0;
  const slices = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const length = Math.max(fraction * CIRCUMFERENCE - GAP, 0);
    const offset = -cumulative * CIRCUMFERENCE;
    cumulative += fraction;
    return { ...d, fraction, length, offset };
  });

  return (
    <div className="chart-card">
      <div className="chart-card-toolbar">
        <div className="chart-legend">
          {data.map((d) => (
            <span key={d.label} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: d.color }} />
              {d.label} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
            </span>
          ))}
        </div>
        <button type="button" className="chart-table-toggle" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {data.length === 0 || total === 0 ? (
        <p className="empty-cell">{emptyMessage}</p>
      ) : showTable ? (
        <table className="data-table" aria-label={ariaLabel}>
          <thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{formatValue(d.value)}</td>
                <td>{Math.round((d.value / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="donut-wrap" role="img" aria-label={ariaLabel}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--chart-grid)" strokeWidth={STROKE} />
              {slices.map((s) => (
                <circle
                  key={s.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${s.length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="butt"
                >
                  <title>{s.label}: {formatValue(s.value)} ({Math.round(s.fraction * 100)}%)</title>
                </circle>
              ))}
            </g>
            <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-center-value">
              {formatValue(total)}
            </text>
            {centerLabel && (
              <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="donut-center-label">
                {centerLabel}
              </text>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
