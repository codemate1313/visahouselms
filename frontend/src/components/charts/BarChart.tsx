import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  formatValue?: (value: number) => string;
  legend?: { label: string; color: string }[];
  emptyMessage?: string;
  ariaLabel: string;
}

const defaultFormat = (v: number) => v.toLocaleString();

export function BarChart({
  data,
  orientation = "horizontal",
  color = "var(--series-1)",
  formatValue = defaultFormat,
  legend,
  emptyMessage = "No data yet.",
  ariaLabel,
}: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="chart-card">
      <div className="chart-card-toolbar">
        {legend && (
          <div className="chart-legend">
            {legend.map((item) => (
              <span key={item.label} className="chart-legend-item">
                <span className="chart-legend-swatch" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="chart-table-toggle" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {data.length === 0 ? (
        <p className="empty-cell">{emptyMessage}</p>
      ) : showTable ? (
        <table className="data-table" aria-label={ariaLabel}>
          <thead><tr><th>Label</th><th>Value</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}><td>{d.label}</td><td>{formatValue(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : orientation === "horizontal" ? (
        <div className="chart-bar-rows" role="img" aria-label={ariaLabel}>
          {data.map((d) => (
            <div className="chart-bar-row" key={d.label}>
              <span className="chart-bar-label">{d.label}</span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill chart-bar-fill-h"
                  style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }}
                >
                  <span className="chart-tooltip">{d.label}: {formatValue(d.value)}</span>
                </div>
              </div>
              <span className="chart-bar-value">{formatValue(d.value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart-columns" role="img" aria-label={ariaLabel}>
          {data.map((d) => (
            <div className="chart-column" key={d.label}>
              <span className="chart-column-value">{formatValue(d.value)}</span>
              <div className="chart-column-track">
                <div
                  className="chart-bar-fill chart-bar-fill-v"
                  style={{ height: `${(d.value / max) * 100}%`, background: d.color ?? color }}
                >
                  <span className="chart-tooltip chart-tooltip-v">{d.label}: {formatValue(d.value)}</span>
                </div>
              </div>
              <span className="chart-column-label">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
