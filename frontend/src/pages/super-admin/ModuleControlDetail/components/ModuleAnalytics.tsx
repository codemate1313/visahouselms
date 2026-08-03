import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { DonutChart } from "@/components/charts/DonutChart";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui";

interface InstitutePerformance {
  institute_id: number | null;
  institute_name: string;
  total_attempts: number;
  completed_attempts: number;
  average_score_pct: number;
  cefr_distribution: Record<string, number>;
  score_distribution: Record<string, number>;
}

interface AnalyticsData {
  total_attempts: number;
  completed_attempts: number;
  average_score_pct: number;
  cefr_distribution: Record<string, number>;
  score_distribution: Record<string, number>;
  institute_performance: InstitutePerformance[];
}

interface ModuleAnalyticsProps {
  moduleId: string;
}

export function ModuleAnalytics({ moduleId }: ModuleAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstId, setSelectedInstId] = useState<string>("all");

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const res = await apiClient.get<AnalyticsData>(`/super-admin/modules/${moduleId}/analytics`);
        setData(res.data);
        setError(null);
      } catch (err) {
        console.error("Failed to load course analytics", err);
        setError("Unable to load performance analytics for this course.");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [moduleId]);

  if (loading) {
    return (
      <div className="course-analytics-loading">
        <div className="analytics-loading-spinner" />
        <p>Loading course performance metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return <div className="detail-error-banner course-analytics-error">{error}</div>;
  }

  // Get current filtered performance metrics
  const currentPerformance = selectedInstId === "all"
    ? null
    : data.institute_performance.find(
        (inst) => (inst.institute_id === null ? "direct" : String(inst.institute_id)) === selectedInstId
      );

  const displayTotalAttempts = currentPerformance ? currentPerformance.total_attempts : data.total_attempts;
  const displayCompletedAttempts = currentPerformance ? currentPerformance.completed_attempts : data.completed_attempts;
  const displayAverageScorePct = currentPerformance ? currentPerformance.average_score_pct : data.average_score_pct;

  const displayCefrDistribution = currentPerformance ? currentPerformance.cefr_distribution : data.cefr_distribution;
  const displayScoreDistribution = currentPerformance ? currentPerformance.score_distribution : data.score_distribution;

  // Format CEFR distribution data for Donut Chart
  const cefrColors: Record<string, string> = {
    A1: "#64748b",
    A2: "#3b82f6",
    B1: "#8b5cf6",
    B2: "#ec4899",
    C1: "#f59e0b",
    C2: "#10b981",
  };
  const cefrChartData = Object.entries(displayCefrDistribution)
    .map(([label, value]) => ({
      label,
      value,
      color: cefrColors[label] || "var(--series-8)",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Format Score ranges distribution data for Donut Chart
  const scoreColors: Record<string, string> = {
    "Under 50%": "#ef4444",
    "50% - 70%": "#3b82f6",
    "70% - 85%": "#8b5cf6",
    "85% or Above": "#10b981",
  };
  const scoreChartData = Object.entries(displayScoreDistribution).map(([label, value]) => ({
    label,
    value,
    color: scoreColors[label] || "var(--slate-500)",
  }));

  const hasChartData = cefrChartData.length > 0 || scoreChartData.some((item) => item.value > 0);

  return (
    <CollapsiblePanel
      className="detail-card course-analytics-panel"
      title="Performance Analytics"
      description="Track sittings, score bands, and institute-wide comparison metrics."
      badge={<span className="count-chip is-accent">{displayTotalAttempts} Attempts</span>}
    >
      <div className="analytics-filter-row">
        <span className="analytics-filter-label">Filter metrics:</span>
        <SearchableSelect
          options={[
            { value: "all", label: "All Institutes" },
            ...data.institute_performance.map((inst) => ({
              value: inst.institute_id === null ? "direct" : String(inst.institute_id),
              label: inst.institute_name,
            })),
          ]}
          value={selectedInstId}
          onChange={(val) => setSelectedInstId(String(val))}
          placeholder="Filter by Institute..."
          className="analytics-inst-filter"
        />
      </div>

      <div className="analytics-overview-cards">
        <article className="overview-metric-card">
          <div className="metric-card-icon is-blue">
            <Icon name="session" />
          </div>
          <div>
            <span className="metric-card-label">Total Student Sittings</span>
            <strong className="metric-card-value">{displayTotalAttempts}</strong>
            <span className="metric-card-subtext">Registered exam sittings</span>
          </div>
        </article>

        <article className="overview-metric-card">
          <div className="metric-card-icon is-green">
            <Icon name="check" />
          </div>
          <div>
            <span className="metric-card-label">Completed Sittings</span>
            <strong className="metric-card-value">{displayCompletedAttempts}</strong>
            <span className="metric-card-subtext">
              {displayTotalAttempts > 0
                ? `${Math.round((displayCompletedAttempts / displayTotalAttempts) * 100)}% completion rate`
                : "No attempts yet"}
            </span>
          </div>
        </article>

        <article className="overview-metric-card">
          <div className="metric-card-icon is-amber">
            <Icon name="analytics" />
          </div>
          <div>
            <span className="metric-card-label">Average Score</span>
            <strong className="metric-card-value">{displayAverageScorePct}%</strong>
            <span className="metric-card-subtext">Overall performance mean</span>
          </div>
        </article>
      </div>

      {hasChartData ? (
        <div className="analytics-charts-grid">
          <div>
            {scoreChartData.some((item) => item.value > 0) ? (
              <DonutChart
                title="Score Range Distribution"
                ariaLabel="Score distribution of students"
                data={scoreChartData}
                centerLabel="scores"
              />
            ) : (
              <div className="analytics-empty-chart-card">
                <h3>Score Range Distribution</h3>
                <p>No graded scores available yet to display distribution.</p>
              </div>
            )}
          </div>
          <div>
            {cefrChartData.length > 0 ? (
              <DonutChart
                title="CEFR Band Distribution"
                ariaLabel="CEFR bands distribution of students"
                data={cefrChartData}
                centerLabel="CEFR sittings"
              />
            ) : (
              <div className="analytics-empty-chart-card">
                <h3>CEFR Band Distribution</h3>
                <p>No CEFR level results recorded yet for this course.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="analytics-empty-state">
          <p>No completed or graded exam sittings available yet to compile distributions.</p>
        </div>
      )}

      <div className="analytics-leaderboard-section">
        <h3>Institute Performance Leaderboard</h3>
        <p className="section-desc">Comparison of sittings, average scores, and top achievements by institute.</p>

        {data.institute_performance.length === 0 ? (
          <div className="analytics-empty-state" style={{ marginTop: 12 }}>
            <p>No sittings recorded from any institute for this module.</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper" style={{ marginTop: 16 }}>
            <table className="data-table sleek-leaderboard-table">
              <thead>
                <tr>
                  <th className="leaderboard-rank-cell">Rank</th>
                  <th>Institute Name</th>
                  <th className="leaderboard-number-cell">Total Sittings</th>
                  <th className="leaderboard-number-cell">Completed</th>
                  <th className="leaderboard-number-cell">Average Score</th>
                  <th>Top Band Distribution</th>
                </tr>
              </thead>
              <tbody>
                {data.institute_performance.map((inst, index) => {
                  const rank = index + 1;
                  const rankClass = rank === 1 ? "rank-first" : rank === 2 ? "rank-second" : rank === 3 ? "rank-third" : "";
                  const isHighlighted = (inst.institute_id === null ? "direct" : String(inst.institute_id)) === selectedInstId;

                  // Get top CEFR level if any
                  const cefrEntries = Object.entries(inst.cefr_distribution);
                  cefrEntries.sort((a, b) => b[1] - a[1]);
                  const topCefr = cefrEntries.slice(0, 3); // show up to top 3 CEFR levels

                  return (
                    <tr
                      key={inst.institute_id ?? "direct"}
                      className={isHighlighted ? "is-highlighted" : undefined}
                    >
                      <td className="leaderboard-rank-cell">
                        <span className={`rank-badge ${rankClass}`}>{rank}</span>
                      </td>
                      <td>
                        <strong>{inst.institute_name}</strong>
                      </td>
                      <td className="leaderboard-number-cell">{inst.total_attempts}</td>
                      <td className="leaderboard-number-cell">{inst.completed_attempts}</td>
                      <td className="leaderboard-number-cell">
                        <strong className={inst.average_score_pct >= 70 ? "score-positive" : undefined}>
                          {inst.average_score_pct}%
                        </strong>
                      </td>
                      <td>
                        {topCefr.length > 0 ? (
                          <div className="leaderboard-cefr-pill-group">
                            {topCefr.map(([band, count]) => (
                              <span key={band} className="cefr-leaderboard-pill" style={{ borderColor: cefrColors[band] }}>
                                <span className="cefr-pill-dot" style={{ background: cefrColors[band] }} />
                                {band}: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="leaderboard-empty-band">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
}
