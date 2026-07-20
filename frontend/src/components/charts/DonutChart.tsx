import { useId, useState } from "react";

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
}

export function DonutChart({ data, centerLabel = "total", ariaLabel, emptyMessage = "No data available." }: DonutChartProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const rows = data.map((item) => ({ ...item, value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0 })).filter((item) => item.value > 0);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  if (!rows.length || total === 0) {
    return <div className="chart-card chart-empty" role="status">{emptyMessage}</div>;
  }

  return <section className="chart-card">
    <div className="chart-card-toolbar"><div className="chart-legend" aria-label="Chart legend">{rows.map((item) => <span className="chart-legend-item" key={item.label}><i className="chart-legend-swatch" style={{ background: item.color }} />{item.label}</span>)}</div><button type="button" className="chart-table-toggle" aria-expanded={showTable} onClick={() => setShowTable((current) => !current)}>{showTable ? "Show chart" : "Show data"}</button></div>
    {showTable ? <div className="chart-data-table-wrap"><table className="chart-data-table"><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>{rows.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.value.toLocaleString("en-IN")}</td><td>{Math.round(item.value / total * 100)}%</td></tr>)}</tbody></table></div> : <div className="donut-layout"><svg className="donut-svg" viewBox="0 0 220 220" role="img" aria-labelledby={titleId}><title id={titleId}>{ariaLabel}</title><circle className="donut-track" cx="110" cy="110" r={radius} />{rows.map((item) => {
      const length = circumference * item.value / total;
      const offset = -consumed;
      consumed += length;
      return <circle className="donut-segment" cx="110" cy="110" r={radius} fill="none" stroke={item.color} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={offset} key={item.label}><title>{`${item.label}: ${item.value} (${Math.round(item.value / total * 100)}%)`}</title></circle>;
    })}<text className="donut-total" x="110" y="105" textAnchor="middle">{total.toLocaleString("en-IN")}</text><text className="donut-label" x="110" y="127" textAnchor="middle">{centerLabel}</text></svg></div>}
  </section>;
}
