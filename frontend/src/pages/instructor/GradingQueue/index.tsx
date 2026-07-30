import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { GradingQueueItem } from "@/api/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader, SearchableSelect } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { gradingQueueStrings as strings } from "./GradingQueue.strings";
import { GradingQueueTable } from "./components/GradingQueueTable";

export function GradingQueue() {
  const isInstituteInstructor = useAuthStore((state) => state.user?.role === "INST_INSTRUCTOR");
  const gradingBase = isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading";
  const [items, setItems] = useState<GradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadQueue = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await apiClient.get<GradingQueueItem[]>("/instructor/grading", {
        params: { status: statusFilter || undefined },
      });
      setItems(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadQueue(true);
    const refreshId = window.setInterval(() => void loadQueue(), 10_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadQueue();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(refreshId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadQueue]);

  const pending = items.filter((item) => item.queue.status === "pending").length;
  const claimed = items.filter((item) => item.queue.status === "claimed").length;
  const reevaluations = items.filter((item) => item.is_reevaluation).length;

  return (
    <div>
      <PageHeader
        title={strings.title}
        subtitle={isInstituteInstructor ? strings.subtitle.instituteInstructor : strings.subtitle.saInstructor}
      />
      <div className="metric-grid">
        <MetricCard label={strings.stats.pending} value={pending} tone="amber" icon="grading" />
        <MetricCard label={strings.stats.claimed} value={claimed} tone="blue" icon="session" />
        <MetricCard label={strings.stats.reevaluations} value={reevaluations} tone="purple" icon="restore" />
      </div>
      <form className="filter-bar" onSubmit={(e) => e.preventDefault()}>
        <SearchableSelect
          ariaLabel={strings.statusFilter.ariaLabel}
          options={[
            { value: "", label: strings.statusFilter.all },
            { value: "pending", label: strings.statusFilter.unclaimed },
            { value: "claimed", label: strings.statusFilter.claimed },
            { value: "completed", label: strings.statusFilter.completed },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(String(value))}
          searchable={false}
          className="status-filter-select"
        />
      </form>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <GradingQueueTable items={items} gradingBase={gradingBase} />
      )}
    </div>
  );
}
