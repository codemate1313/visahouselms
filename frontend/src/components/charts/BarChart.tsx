import { useId, useState } from "react";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
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

const DEFAULT_COLOR = "var(--series-1)";

function safeValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function shortLabel(label: string, maximum: number): string {
  return label.length > maximum ? `${label.slice(0, maximum - 1)}…` : label;
}

export function BarChart({
  data,
  orientation = "vertical",
  color = DEFAULT_COLOR,
  legend,
  formatValue = (value) => value.toLocaleString("en-IN"),
  ariaLabel,
  emptyMessage = "No data available.",
}: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const rows = data.map((item) => ({ ...item, value: safeValue(item.value) }));
  const maximum = Math.max(0, ...rows.map((item) => item.value));

  if (!rows.length || maximum === 0) {
    return <div className="chart-card chart-empty" role="status">{emptyMessage}</div>;
  }

  return <section className="chart-card">
    <div className="chart-card-toolbar">
      {legend?.length ? <div className="chart-legend" aria-label="Chart legend">{legend.map((item) => <span className="chart-legend-item" key={item.label}><i className="chart-legend-swatch" style={{ background: item.color }} />{item.label}</span>)}</div> : <span />}
      <button type="button" className="chart-table-toggle" aria-expanded={showTable} onClick={() => setShowTable((current) => !current)}>{showTable ? "Show chart" : "Show data"}</button>
    </div>
    {showTable ? <ChartTable rows={rows} formatValue={formatValue} /> : orientation === "horizontal"
      ? <HorizontalBars rows={rows} maximum={maximum} color={color} formatValue={formatValue} ariaLabel={ariaLabel} titleId={titleId} />
      : <VerticalBars rows={rows} maximum={maximum} color={color} formatValue={formatValue} ariaLabel={ariaLabel} titleId={titleId} />}
  </section>;
}

interface InternalChartProps {
  rows: BarChartDatum[];
  maximum: number;
  color: string;
  formatValue: (value: number) => string;
  ariaLabel: string;
  titleId: string;
}

function HorizontalBars({ rows, maximum, color, formatValue, ariaLabel, titleId }: InternalChartProps) {
  const width = 720;
  const left = 158;
  const right = 92;
  const top = 24;
  const rowHeight = 46;
  const plotWidth = width - left - right;
  const height = Math.max(190, top * 2 + rows.length * rowHeight);

  return <div className="chart-svg-wrap"><svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
    <title id={titleId}>{ariaLabel}</title>
    {[0, 0.25, 0.5, 0.75, 1].map((tick) => <line className="chart-grid-line" x1={left + plotWidth * tick} x2={left + plotWidth * tick} y1={12} y2={height - 12} key={tick} />)}
    {rows.map((item, index) => {
      const y = top + index * rowHeight;
      const barWidth = Math.max(2, plotWidth * item.value / maximum);
      return <g key={`${item.label}-${index}`}>
        <title>{`${item.label}: ${formatValue(item.value)}`}</title>
        <text className="chart-label chart-label-left" x={left - 12} y={y + 17}>{shortLabel(item.label, 23)}</text>
        <rect className="chart-bar" x={left} y={y} width={barWidth} height={24} rx={5} fill={item.color ?? color} />
        <text className="chart-value" x={Math.min(left + barWidth + 8, width - right + 8)} y={y + 17}>{formatValue(item.value)}</text>
      </g>;
    })}
  </svg></div>;
}

function VerticalBars({ rows, maximum, color, formatValue, ariaLabel, titleId }: InternalChartProps) {
  const width = 720;
  const height = 310;
  const left = 54;
  const right = 18;
  const top = 28;
  const bottom = 66;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const slot = plotWidth / rows.length;
  const barWidth = Math.min(58, Math.max(12, slot * 0.58));

  return <div className="chart-svg-wrap"><svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
    <title id={titleId}>{ariaLabel}</title>
    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
      const y = top + plotHeight * (1 - tick);
      return <g key={tick}><line className="chart-grid-line" x1={left} x2={width - right} y1={y} y2={y} /><text className="chart-axis-label" x={left - 9} y={y + 4}>{formatValue(maximum * tick)}</text></g>;
    })}
    {rows.map((item, index) => {
      const barHeight = Math.max(2, plotHeight * item.value / maximum);
      const x = left + index * slot + (slot - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      return <g key={`${item.label}-${index}`}>
        <title>{`${item.label}: ${formatValue(item.value)}`}</title>
        <rect className="chart-bar" x={x} y={y} width={barWidth} height={barHeight} rx={5} fill={item.color ?? color} />
        <text className="chart-label" textAnchor="middle" x={x + barWidth / 2} y={height - 40}>{shortLabel(item.label, 12)}</text>
      </g>;
    })}
  </svg></div>;
}

function ChartTable({ rows, formatValue }: { rows: BarChartDatum[]; formatValue: (value: number) => string }) {
  return <div className="chart-data-table-wrap"><table className="chart-data-table"><thead><tr><th>Category</th><th>Value</th></tr></thead><tbody>{rows.map((item, index) => <tr key={`${item.label}-${index}`}><td>{item.label}</td><td>{formatValue(item.value)}</td></tr>)}</tbody></table></div>;
}
