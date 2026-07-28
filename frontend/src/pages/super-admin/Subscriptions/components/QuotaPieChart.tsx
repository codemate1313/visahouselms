import { useState } from "react";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";

interface QuotaPieChartProps {
  usage: Record<string, number>;
  limits: Record<string, number>;
}

export function QuotaPieChart({ usage, limits }: QuotaPieChartProps) {
  const [showTable, setShowTable] = useState(false);
  const t = strings.quotaChart;
  const studentUsed = usage.students ?? 0;
  const studentLimit = limits.students ?? 0;
  const staffUsed = usage.staff ?? 0;
  const staffLimit = limits.staff ?? 0;
  // Courses are handed out of a shared catalogue, so the "limit" is how many
  // exist to give - unlike seats, which are what the agreement bought.
  const courseUsed = usage.courses ?? 0;
  const courseLimit = limits.courses ?? 0;

  const totalUsed = studentUsed + staffUsed + courseUsed;
  const totalLimit = studentLimit + staffLimit + courseLimit;
  const overallPercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

  const studentPercent = studentLimit > 0 ? Math.min(100, Math.round((studentUsed / studentLimit) * 100)) : 0;
  const staffPercent = staffLimit > 0 ? Math.min(100, Math.round((staffUsed / staffLimit) * 100)) : 0;
  const coursePercent = courseLimit > 0 ? Math.min(100, Math.round((courseUsed / courseLimit) * 100)) : 0;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallPercent / 100) * circumference;

  return (
    <div className="quota-analytics-card">
      <div className="chart-card-toolbar" style={{ marginBottom: 12 }}>
        <h3 className="analytics-card-title" style={{ margin: 0 }}>{t.title}</h3>
        <div className="chart-view-toggle-pill">
          <button type="button" className={`pill-btn ${!showTable ? "active" : ""}`} onClick={() => setShowTable(false)} title={t.chartViewTitle}>
            ≡
          </button>
          <button type="button" className={`pill-btn ${showTable ? "active" : ""}`} onClick={() => setShowTable(true)} title={t.tableViewTitle}>
            田
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="chart-data-table-wrap">
          <table className="chart-data-table">
            <thead>
              <tr>
                <th>{t.resource}</th>
                <th>{t.used}</th>
                <th>{t.limit}</th>
                <th>{t.share}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t.students}</td>
                <td>{studentUsed}</td>
                <td>{studentLimit}</td>
                <td>{studentPercent}%</td>
              </tr>
              <tr>
                <td>{t.instructors}</td>
                <td>{staffUsed}</td>
                <td>{staffLimit}</td>
                <td>{staffPercent}%</td>
              </tr>
              <tr>
                <td>{t.courses}</td>
                <td>{courseUsed}</td>
                <td>{courseLimit}</td>
                <td>{coursePercent}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="donut-pie-row">
          <div className="donut-chart-wrap">
            <svg width="110" height="110" viewBox="0 0 100 100" className="donut-svg">
              <circle cx="50" cy="50" r={radius} className="donut-bg" />
              <circle cx="50" cy="50" r={radius} className="donut-fill" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
            </svg>
            <div className="donut-center-text">
              <span className="donut-value">{totalUsed}</span>
              <span className="donut-sublabel">/ {totalLimit}</span>
            </div>
          </div>

          <div className="donut-legend">
            <div className="legend-item">
              <span className="legend-dot dot-students" />
              <div className="legend-info">
                <span className="legend-name">{t.students}</span>
                <strong className="legend-stat">
                  {studentUsed} / {studentLimit} ({studentPercent}%)
                </strong>
              </div>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-staff" />
              <div className="legend-info">
                <span className="legend-name">{t.instructors}</span>
                <strong className="legend-stat">
                  {staffUsed} / {staffLimit} ({staffPercent}%)
                </strong>
              </div>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-tests" />
              <div className="legend-info">
                <span className="legend-name">{t.courses}</span>
                <strong className="legend-stat">
                  {courseUsed} / {courseLimit} ({coursePercent}%)
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
