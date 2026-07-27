import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { PAYMENT_STATUS_COLORS, SUBSCRIPTION_STATE_COLORS, formatMoney } from "../helpers";
import type { Summary } from "../types";

export type ChartKey = "byInstitute" | "byMonth" | "paymentStatus" | "instituteState";
export type TimeframeOption = "1M" | "3M" | "6M" | "1Y";

interface ChartDetailModalProps {
  chartKey: ChartKey;
  summary: Summary;
  onClose: () => void;
}

export function ChartDetailModal({ chartKey, summary, onClose }: ChartDetailModalProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1Y");
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const t = strings.charts;
  const stateLabels = strings.subscriptionStateLabels;

  const timeframeOptions: TimeframeOption[] = ["1M", "3M", "6M", "1Y"];
  const activeIndex = timeframeOptions.indexOf(timeframe);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>(".timeframe-tab-btn");
    const activeButton = buttons[activeIndex];
    if (activeButton) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setPillStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  let title = "";
  let description = "";
  let chartElement: React.ReactNode = null;
  let breakdownItems: Array<{ label: string; value: string; share: string; color?: string }> = [];

  if (chartKey === "byInstitute") {
    title = t.byInstituteTitle;
    description = "Revenue performance across partner institute accounts";
    const rawData = summary.revenue_by_institute.map((r) => ({
      label: r.institute_name,
      value: Number(r.total),
    }));
    const totalRev = rawData.reduce((acc, curr) => acc + curr.value, 0);
    breakdownItems = rawData.map((d) => ({
      label: d.label,
      value: formatMoney(d.value),
      share: totalRev > 0 ? `${Math.round((d.value / totalRev) * 100)}%` : "0%",
    }));
    chartElement = (
      <BarChart
        data={rawData}
        title={title}
        orientation="vertical"
        formatValue={formatMoney}
        ariaLabel={t.byInstituteAriaLabel}
        emptyMessage={t.revenueEmpty}
      />
    );
  } else if (chartKey === "byMonth") {
    title = t.byMonthTitle;
    description = "Monthly revenue trajectory and billing history";
    let rawMonths = summary.revenue_by_month;
    if (timeframe === "1M") rawMonths = rawMonths.slice(-1);
    else if (timeframe === "3M") rawMonths = rawMonths.slice(-3);
    else if (timeframe === "6M") rawMonths = rawMonths.slice(-6);

    const rawData = rawMonths.map((r) => ({
      label: r.month,
      value: Number(r.total),
    }));
    const totalRev = rawData.reduce((acc, curr) => acc + curr.value, 0);
    breakdownItems = rawData.map((d) => ({
      label: d.label,
      value: formatMoney(d.value),
      share: totalRev > 0 ? `${Math.round((d.value / totalRev) * 100)}%` : "0%",
    }));
    chartElement = (
      <LineChart
        data={rawData}
        title={title}
        formatValue={formatMoney}
        ariaLabel={t.byMonthAriaLabel}
        emptyMessage={t.revenueEmpty}
      />
    );
  } else if (chartKey === "paymentStatus") {
    title = t.paymentStatusTitle;
    description = "Breakdown of platform payment transactions by status";
    const rawData = summary.payment_status_breakdown.map((p) => ({
      label: p.status.charAt(0).toUpperCase() + p.status.slice(1),
      value: p.count,
      color: PAYMENT_STATUS_COLORS[p.status] ?? "var(--series-1)",
    }));
    const totalCount = rawData.reduce((acc, curr) => acc + curr.value, 0);
    breakdownItems = rawData.map((d) => ({
      label: d.label,
      value: `${d.value} transactions`,
      share: totalCount > 0 ? `${Math.round((d.value / totalCount) * 100)}%` : "0%",
      color: d.color,
    }));
    chartElement = (
      <DonutChart
        data={rawData}
        title={title}
        centerLabel={t.paymentStatusCenterLabel}
        ariaLabel={t.paymentStatusAriaLabel}
        emptyMessage={t.paymentStatusEmpty}
      />
    );
  } else if (chartKey === "instituteState") {
    title = t.instituteStateTitle;
    description = "Distribution of partner institutes by active subscription state";
    const rawData = summary.institute_status_breakdown.map((s) => ({
      label: stateLabels[s.state as keyof typeof stateLabels] ?? s.state,
      value: s.count,
      color: SUBSCRIPTION_STATE_COLORS[s.state] ?? "var(--series-1)",
    }));
    const totalCount = rawData.reduce((acc, curr) => acc + curr.value, 0);
    const legend = rawData.map((d) => ({ label: d.label, color: d.color }));
    breakdownItems = rawData.map((d) => ({
      label: d.label,
      value: `${d.value} institutes`,
      share: totalCount > 0 ? `${Math.round((d.value / totalCount) * 100)}%` : "0%",
      color: d.color,
    }));
    chartElement = (
      <BarChart
        data={rawData}
        title={title}
        orientation="vertical"
        legend={legend}
        ariaLabel={t.instituteStateAriaLabel}
        emptyMessage={t.instituteStateEmpty}
      />
    );
  }

  return createPortal(
    <div className="dashboard-detail-backdrop" onMouseDown={onClose}>
      <section
        className="dashboard-detail-dialog chart-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dashboard-detail-header">
          <div>
            <span className="page-eyebrow">ANALYTICS DETAIL</span>
            <h2 id="chart-detail-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="dashboard-detail-close"
            onClick={onClose}
            aria-label="Close chart details"
            title="Close"
            autoFocus
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-close-icon">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="dashboard-detail-body chart-modal-body">
          {/* Segmented Timeframe Control (1M, 3M, 6M, 1Y) */}
          <div className="chart-timeframe-toolbar">
            <span className="timeframe-toolbar-label">TIMEFRAME</span>
            <div className="chart-timeframe-segmented-control" ref={containerRef}>
              {pillStyle.width > 0 && (
                <span
                  className="timeframe-sliding-pill"
                  style={{
                    left: `${pillStyle.left}px`,
                    width: `${pillStyle.width}px`,
                  }}
                />
              )}
              {timeframeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`timeframe-tab-btn ${timeframe === opt ? "active" : ""}`}
                  onClick={() => setTimeframe(opt)}
                >
                  {opt === "1M" ? "1 Month" : opt === "3M" ? "3 Months" : opt === "6M" ? "6 Months" : "1 Year"}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Modal Chart View */}
          <div className="chart-modal-view-container">
            {chartElement}
          </div>

          {/* Detailed Breakdown List */}
          {breakdownItems.length > 0 && (
            <div className="dashboard-records-list" style={{ marginTop: 24 }}>
              <div className="records-count-bar">
                <div className="records-count-left">
                  <span className="records-count-indicator" />
                  <span className="records-count-label">BREAKDOWN DATA ({timeframe})</span>
                </div>
                <span className="records-count-badge">{breakdownItems.length} ITEMS</span>
              </div>

              <div className="chart-breakdown-grid">
                {breakdownItems.map((item) => (
                  <article className="chart-breakdown-card" key={item.label}>
                    <div className="breakdown-card-header">
                      {item.color && <span className="breakdown-color-dot" style={{ background: item.color }} />}
                      <span className="breakdown-item-label">{item.label}</span>
                    </div>
                    <div className="breakdown-card-values">
                      <strong className="breakdown-value-text">{item.value}</strong>
                      <span className="breakdown-share-badge">{item.share}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
