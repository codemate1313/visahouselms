import { useEffect, useRef, useState } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/ui";
import { dashboardStrings as strings } from "./Dashboard.strings";
import type { MetricDetail, MetricKey, Summary } from "./types";
import { computeRevenueTrend } from "./helpers";
import { ExecutiveMetricGrid } from "./components/ExecutiveMetricGrid";
import { DashboardCharts } from "./components/DashboardCharts";
import { MetricDetailModal } from "./components/MetricDetailModal";
import { PendingSignupsAlert } from "./components/PendingSignupsAlert";
import { NoLivePlanAlert } from "./components/NoLivePlanAlert";
import { AiQuotaCard } from "./components/AiQuotaCard";
import { ServerMemoryCard } from "./components/ServerMemoryCard";

type DashboardCardGroup = "institute" | "technical";

export function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<DashboardCardGroup>("institute");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [metricDetail, setMetricDetail] = useState<MetricDetail | null>(null);
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricError, setMetricError] = useState<string | null>(null);
  const metricRequestId = useRef(0);

  useEffect(() => {
    apiClient
      .get<Summary>("/super-admin/dashboard/summary")
      .then(({ data }) => setSummary(data))
      .catch(() => setError(strings.loadError));
  }, []);

  useEffect(() => {
    if (!selectedMetric) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMetric(null);
    };
    const releaseScroll = lockBodyScroll();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      releaseScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedMetric]);

  async function openMetric(metric: MetricKey) {
    const requestId = ++metricRequestId.current;
    setSelectedMetric(metric);
    setMetricDetail(null);
    setMetricError(null);
    setMetricLoading(true);
    try {
      const { data } = await apiClient.get<MetricDetail>(`/super-admin/dashboard/metrics/${metric}`, {
        headers: { "X-Skip-Loader": "true" },
      });
      if (requestId !== metricRequestId.current) return;
      setMetricDetail(data);
    } catch {
      if (requestId !== metricRequestId.current) return;
      setMetricError(strings.detailModal.loadDetailsError);
    } finally {
      if (requestId === metricRequestId.current) setMetricLoading(false);
    }
  }

  function closeMetric() {
    metricRequestId.current += 1;
    setSelectedMetric(null);
    setMetricDetail(null);
    setMetricError(null);
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>{strings.loading}</p>;

  const revenueTrend = computeRevenueTrend(summary.revenue_by_month);

  return (
    <div className="dashboard-overview">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.welcome(user?.first_name)}
        subtitle={strings.subtitle}
      />

      {summary.counts.institute_signups_pending > 0 && (
        <PendingSignupsAlert count={summary.counts.institute_signups_pending} />
      )}
      {summary.counts.plans_live === 0 && <NoLivePlanAlert />}

      <div className="dashboard-card-groups" aria-label="Dashboard card groups">
        <button
          type="button"
          className={activeGroup === "institute" ? "is-active" : ""}
          onClick={() => setActiveGroup("institute")}
          aria-pressed={activeGroup === "institute"}
        >
          Institute Info
        </button>
        <button
          type="button"
          className={activeGroup === "technical" ? "is-active" : ""}
          onClick={() => setActiveGroup("technical")}
          aria-pressed={activeGroup === "technical"}
        >
          Technical Info
        </button>
      </div>

      {activeGroup === "institute" ? (
        <>
          <ExecutiveMetricGrid summary={summary} revenueTrend={revenueTrend} onOpen={openMetric} />
          {summary.permissions.can_view_monetary_analytics && summary.revenue && (
            <div className="dashboard-charts-grid">
              <DashboardCharts summary={summary} />
            </div>
          )}
        </>
      ) : (
        <div className="dashboard-charts-grid dashboard-charts-grid--technical">
          <AiQuotaCard />
          <ServerMemoryCard />
        </div>
      )}

      {selectedMetric && (
        <MetricDetailModal
          selectedMetric={selectedMetric}
          metricDetail={metricDetail}
          metricLoading={metricLoading}
          metricError={metricError}
          onClose={closeMetric}
        />
      )}
    </div>
  );
}
