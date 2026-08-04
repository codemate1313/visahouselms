import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { useDashboardRangeStore } from "@/store/dashboardRangeStore";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/ui";
import { dashboardStrings as strings } from "./Dashboard.strings";
import type { MetricDetail, MetricKey, Summary } from "./types";
import { ExecutiveMetricGrid } from "./components/ExecutiveMetricGrid";
import { DashboardCharts } from "./components/DashboardCharts";
import { MetricDetailModal } from "./components/MetricDetailModal";
import { PendingSignupsAlert } from "./components/PendingSignupsAlert";
import { NoLivePlanAlert } from "./components/NoLivePlanAlert";

export function Dashboard() {
  const range = useDashboardRangeStore((state) => state.range);
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMetric(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
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

  const growth = strings.growth[range] || strings.growth["7D"];

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
      <ExecutiveMetricGrid summary={summary} growth={growth} onOpen={openMetric} />
      {summary.permissions.can_view_monetary_analytics && summary.revenue && <DashboardCharts summary={summary} />}

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
