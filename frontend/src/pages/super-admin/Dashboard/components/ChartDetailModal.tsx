import { useEffect, useState } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { createPortal } from "react-dom";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { LineChart } from "@/components/charts/LineChart";
import { SegmentedControl } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { PAYMENT_STATUS_COLORS, STUDENT_TYPE_COLORS, SUBSCRIPTION_STATE_COLORS, formatMoney } from "../helpers";
import type { Summary } from "../types";

export type ChartKey = "byInstitute" | "byMonth" | "paymentStatus" | "studentType" | "instituteState";

interface FilterOption {
  id: string;
  label: string;
}

interface FilterConfig {
  label: string;
  defaultOption: string;
  options: FilterOption[];
}

interface ChartDetailModalProps {
  chartKey: ChartKey;
  summary: Summary;
  onClose: () => void;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function computePresetDates(presetId: string, latestMonthStr: string = currentMonthKey()) {
  const parts = latestMonthStr.split("-");
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 7;

  const toDate = `${year}-${String(month).padStart(2, "0")}`;
  let fromDate = toDate;

  if (presetId === "1M") {
    fromDate = toDate;
  } else if (presetId === "3M") {
    let fromM = month - 2;
    let fromY = year;
    if (fromM < 1) {
      fromM += 12;
      fromY -= 1;
    }
    fromDate = `${fromY}-${String(fromM).padStart(2, "0")}`;
  } else if (presetId === "6M") {
    let fromM = month - 5;
    let fromY = year;
    if (fromM < 1) {
      fromM += 12;
      fromY -= 1;
    }
    fromDate = `${fromY}-${String(fromM).padStart(2, "0")}`;
  } else if (presetId === "1Y") {
    let fromM = month - 11;
    let fromY = year;
    if (fromM < 1) {
      fromM += 12;
      fromY -= 1;
    }
    fromDate = `${fromY}-${String(fromM).padStart(2, "0")}`;
  }

  return { fromDate, toDate };
}

export function ChartDetailModal({ chartKey, summary, onClose }: ChartDetailModalProps) {
  // Determine suitable filter options based on graph type
  const filterConfig: FilterConfig = (() => {
    switch (chartKey) {
      case "byInstitute":
        return {
          label: "INSTITUTE FILTER",
          defaultOption: "all",
          options: [
            { id: "all", label: "All Partner Institutes" },
            { id: "high", label: "High Revenue (> ₹500)" },
            { id: "top", label: "Top Performer" },
          ],
        };
      case "byMonth":
        return {
          label: "TIME HORIZON",
          defaultOption: "1Y",
          options: [
            { id: "1M", label: "1 Month" },
            { id: "3M", label: "3 Months" },
            { id: "6M", label: "6 Months" },
            { id: "1Y", label: "1 Year" },
            { id: "custom", label: "Custom Range" },
          ],
        };
      case "paymentStatus":
        return {
          label: "PAYMENT STATUS",
          defaultOption: "all",
          options: [
            { id: "all", label: "All Statuses" },
            { id: "partial", label: "Partial Payments" },
            { id: "paid", label: "Completed Paid" },
            { id: "failed", label: "Failed / Refused" },
          ],
        };
      case "studentType":
        return {
          label: "STUDENT TYPE",
          defaultOption: "all",
          options: [
            { id: "all", label: "All Students" },
            { id: "direct", label: "Direct Students" },
            { id: "institute", label: "Institute Students" },
          ],
        };
      case "instituteState":
      default:
        return {
          label: "SUBSCRIPTION STATE",
          defaultOption: "all",
          options: [
            { id: "all", label: "All States" },
            { id: "active", label: "Active" },
            { id: "in_grace", label: "In Grace" },
            { id: "expired", label: "Expired" },
          ],
        };
    }
  })();

  const latestMonth = summary.revenue_by_month.length > 0
    ? summary.revenue_by_month[summary.revenue_by_month.length - 1].month
    : currentMonthKey();

  const initialDates = computePresetDates(filterConfig.defaultOption, latestMonth);

  const [activeFilter, setActiveFilter] = useState<string>(filterConfig.defaultOption);
  const [fromDate, setFromDate] = useState<string>(initialDates.fromDate);
  const [toDate, setToDate] = useState<string>(initialDates.toDate);

  const t = strings.charts;
  const stateLabels = strings.subscriptionStateLabels;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const releaseScroll = lockBodyScroll();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handlePresetSelect = (optId: string) => {
    setActiveFilter(optId);
    if (optId !== "custom") {
      const { fromDate: f, toDate: t } = computePresetDates(optId, latestMonth);
      setFromDate(f);
      setToDate(t);
    }
  };

  let title = "";
  let description = "";
  let chartElement: React.ReactNode = null;
  let breakdownItems: Array<{ label: string; value: string; share: string; color?: string }> = [];

  if (chartKey === "byInstitute") {
    title = t.byInstituteTitle;
    description = "Revenue performance across partner institute accounts";

    let rawData = summary.revenue_by_institute.map((r) => ({
      label: r.institute_name,
      value: Number(r.total),
    }));

    if (activeFilter === "high") {
      rawData = rawData.filter((d) => d.value >= 500);
    } else if (activeFilter === "top") {
      rawData = [...rawData].sort((a, b) => b.value - a.value).slice(0, 1);
    }

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

    let rawMonths = summary.revenue_by_month.filter((r) => {
      if (fromDate && r.month < fromDate) return false;
      if (toDate && r.month > toDate) return false;
      return true;
    });

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
    let rawData = summary.payment_status_breakdown.map((p) => ({
      label: p.status.charAt(0).toUpperCase() + p.status.slice(1),
      value: p.count,
      color: PAYMENT_STATUS_COLORS[p.status] ?? "var(--series-1)",
    }));

    if (activeFilter !== "all") {
      rawData = rawData.filter((d) => d.label.toLowerCase().includes(activeFilter.toLowerCase()));
    }

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
  } else if (chartKey === "studentType") {
    title = t.studentTypeTitle;
    description = "Distribution of direct learners and institute-enrolled students";
    let rawData = (summary.student_type_breakdown ?? []).map((s) => ({
      label: s.label,
      value: s.count,
      color: STUDENT_TYPE_COLORS[s.type] ?? "var(--series-1)",
      type: s.type,
    }));

    if (activeFilter !== "all") {
      rawData = rawData.filter((d) => d.type === activeFilter);
    }

    const totalCount = rawData.reduce((acc, curr) => acc + curr.value, 0);
    breakdownItems = rawData.map((d) => ({
      label: d.label,
      value: `${d.value} students`,
      share: totalCount > 0 ? `${Math.round((d.value / totalCount) * 100)}%` : "0%",
      color: d.color,
    }));
    chartElement = (
      <DonutChart
        data={rawData}
        title={title}
        centerLabel={t.studentTypeCenterLabel}
        ariaLabel={t.studentTypeAriaLabel}
        emptyMessage={t.studentTypeEmpty}
      />
    );
  } else if (chartKey === "instituteState") {
    title = t.instituteStateTitle;
    description = "Distribution of partner institutes by active subscription state";
    let rawData = summary.institute_status_breakdown.map((s) => ({
      label: stateLabels[s.state as keyof typeof stateLabels] ?? s.state,
      value: s.count,
      color: SUBSCRIPTION_STATE_COLORS[s.state] ?? "var(--series-1)",
    }));

    if (activeFilter !== "all") {
      rawData = rawData.filter((d) => {
        const stateKey = Object.keys(stateLabels).find((k) => stateLabels[k as keyof typeof stateLabels] === d.label);
        return stateKey === activeFilter || d.label.toLowerCase().replace(/\s+/g, "_") === activeFilter;
      });
    }

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

  const activeOptionLabel =
    fromDate && toDate
      ? `TIMELINE: ${fromDate} TO ${toDate}`
      : filterConfig.options.find((opt) => opt.id === activeFilter)?.label ?? "SELECTED FILTER";

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
          <IconButton
            className="dashboard-detail-close"
            onClick={onClose}
            label="Close chart details"
            autoFocus
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-close-icon">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </header>

        <div className="dashboard-detail-body chart-modal-body">
          {/* Custom Contextual Filter Toolbar with Timeline Range Picker */}
          <div className="chart-timeframe-toolbar" style={{ flexWrap: "wrap", gap: 14 }}>
            <span className="timeframe-toolbar-label">{filterConfig.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <SegmentedControl
                ariaLabel={filterConfig.label}
                className="chart-timeframe-control"
                onChange={handlePresetSelect}
                options={filterConfig.options.map((option) => ({
                  label: option.label,
                  value: option.id,
                }))}
                size="sm"
                value={activeFilter}
              />

              {/* Timeline From Date -> To Date Inputs */}
              {chartKey === "byMonth" && (
                <div className="chart-custom-date-picker" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-muted, #f8fafc)", padding: "4px 10px", borderRadius: 12, border: "1px solid var(--border-subtle, rgba(203,213,225,0.8))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--slate-500))" }}>From:</span>
                    <input
                      type="month"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setActiveFilter("custom");
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border, var(--border))", background: "var(--surface, var(--white))", fontSize: 12, fontWeight: 600, color: "var(--text, var(--slate-900))", outline: "none" }}
                    />
                  </div>
                  <span style={{ color: "var(--text-muted, var(--slate-400))", fontSize: 12, fontWeight: 700 }}>&rarr;</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, var(--slate-500))" }}>To:</span>
                    <input
                      type="month"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setActiveFilter("custom");
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border, var(--border))", background: "var(--surface, var(--white))", fontSize: 12, fontWeight: 600, color: "var(--text, var(--slate-900))", outline: "none" }}
                    />
                  </div>
                </div>
              )}
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
                  <span className="records-count-label">BREAKDOWN DATA ({activeOptionLabel.toUpperCase()})</span>
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
