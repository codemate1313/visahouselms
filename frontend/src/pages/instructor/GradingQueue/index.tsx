import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { GradingQueueItem } from "@/api/types";
import { SearchableSelect } from "@/components/ui";
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

  useEffect(() => {
    setLoading(true);
    apiClient
      .get<GradingQueueItem[]>("/instructor/grading", { params: { status: statusFilter || undefined } })
      .then(({ data }) => setItems(data))
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const pending = items.filter((item) => item.queue.status === "pending").length;
  const claimed = items.filter((item) => item.queue.status === "claimed").length;
  const reevaluations = items.filter((item) => item.is_reevaluation).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">
            {isInstituteInstructor ? strings.subtitle.instituteInstructor : strings.subtitle.saInstructor}
          </p>
        </div>
      </div>
      <div className="stat-tile-row">
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.pending}</p>
          <p className="stat-value">{pending}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.claimed}</p>
          <p className="stat-value">{claimed}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">{strings.stats.reevaluations}</p>
          <p className="stat-value">{reevaluations}</p>
        </div>
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
