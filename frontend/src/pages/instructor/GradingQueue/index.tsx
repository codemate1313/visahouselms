import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import type { GradingQueueItem } from "@/api/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader, SearchableSelect, SearchInput } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
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
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (skillFilter && item.module_type !== skillFilter) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesStudent = item.student_name.toLowerCase().includes(query);
        const matchesModule = item.module_title.toLowerCase().includes(query);
        if (!matchesStudent && !matchesModule) {
          return false;
        }
      }
      return true;
    });
  }, [items, search, skillFilter]);

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
      <form className="filter-bar" onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by student name or test title..."
          width={280}
        />
        <SearchableSelect
          ariaLabel={strings.statusFilter.ariaLabel}
          options={[
            { value: "", label: "All Statuses" },
            { value: "pending", label: strings.statusFilter.unclaimed },
            { value: "claimed", label: strings.statusFilter.claimed },
            { value: "completed", label: strings.statusFilter.completed },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(String(value))}
          searchable={false}
          className="status-filter-select"
        />
        <SearchableSelect
          ariaLabel="Skill Filter"
          options={[
            { value: "", label: "All Skills" },
            { value: "listening", label: "Listening" },
            { value: "reading", label: "Reading" },
            { value: "writing", label: "Writing" },
            { value: "speaking", label: "Speaking" },
          ]}
          value={skillFilter}
          onChange={(value) => setSkillFilter(String(value))}
          searchable={false}
          className="skill-filter-select"
        />
      </form>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <RouteLoadingState />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <h2>No matching items</h2>
          <p>Try clearing your filters or changing your search query.</p>
        </div>
      ) : (
        <GradingQueueTable items={filteredItems} gradingBase={gradingBase} />
      )}
    </div>
  );
}

