import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { AttemptSummary } from "@/api/types";
import { Icon } from "@/components/icons";
import { Badge, PageHeader, SearchableSelect } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { formatDateTime } from "@/utils/date";
import { studentAttemptsStrings as strings } from "./StudentAttempts.strings";
import type { BadgeTone } from "@/components/ui";
import { attemptTargetUrl } from "./StudentDashboard/helpers";

const STATUS_CLASS: Record<string, BadgeTone> = {
  ready: "blue",
  in_progress: "amber",
  submitted: "gray",
  grading: "amber",
  graded: "green",
  expired: "red",
};

function attemptStatusLabel(attempt: AttemptSummary) {
  return strings.statusLabels[attempt.status as keyof typeof strings.statusLabels] ?? attempt.status;
}

function attemptStatusTone(attempt: AttemptSummary): BadgeTone {
  return STATUS_CLASS[attempt.status] ?? "gray";
}

const ATTEMPTS_REQUEST_TIMEOUT_MS = 15000;
const GRADING_REFRESH_INTERVAL_MS = 8000;

export function StudentAttempts() {
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedGradingType, setSelectedGradingType] = useState<string>("all");
  const requestIdRef = useRef(0);

  const loadAttempts = useCallback(async (showInitialLoading = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ATTEMPTS_REQUEST_TIMEOUT_MS);

    if (showInitialLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const { data } = await apiClient.get<AttemptSummary[]>("/student/attempts", {
        signal: controller.signal,
        headers: { "X-Skip-Loader": "1" },
      });
      if (requestIdRef.current === requestId) {
        setAttempts(data);
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        const aborted = err instanceof Error && err.name === "CanceledError";
        setError(aborted ? strings.timeoutError : strings.loadError);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAttempts(true);
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadAttempts]);

  useEffect(() => {
    if (!attempts.some((attempt) => attempt.status === "submitted" || attempt.status === "grading")) return;

    const intervalId = window.setInterval(() => {
      void loadAttempts(false);
    }, GRADING_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [attempts, loadAttempts]);

  if (loading) return <p>{strings.loading}</p>;

  const filteredAttempts = attempts.filter((attempt) => {
    if (selectedStatus !== "all" && attempt.status !== selectedStatus) {
      return false;
    }
    if (selectedGradingType === "all") {
      return true;
    }
    if (selectedGradingType === "ai_graded") {
      return Boolean(attempt.is_ai_graded);
    }
    if (selectedGradingType === "instructor_requested") {
      return Boolean(attempt.instructor_requested);
    }
    if (selectedGradingType === "pending_grading") {
      return Boolean(attempt.is_pending_grading);
    }
    if (selectedGradingType === "instructor_graded") {
      return Boolean(attempt.is_instructor_graded);
    }
    return true;
  });

  const today: AttemptSummary[] = [];
  const yesterday: AttemptSummary[] = [];
  const older: AttemptSummary[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  filteredAttempts.forEach((attempt) => {
    if (!attempt.started_at) {
      older.push(attempt);
      return;
    }
    const date = new Date(attempt.started_at).getTime();
    if (date >= todayStart) {
      today.push(attempt);
    } else if (date >= yesterdayStart) {
      yesterday.push(attempt);
    } else {
      older.push(attempt);
    }
  });

  const renderRow = (attempt: AttemptSummary) => (
    <tr key={attempt.id} className="clickable">
      <td>{attempt.module_title}</td>
      <td>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
          <Badge tone={attemptStatusTone(attempt)}>
            {attemptStatusLabel(attempt)}
          </Badge>
          {attempt.instructor_requested && (!attempt.reevaluation_status || ["pending", "in_review"].includes(attempt.reevaluation_status)) && (
            <Badge tone="purple" title="Re-evaluation requested from instructor">
              {strings.gradingBadges.instructor_requested}
            </Badge>
          )}
          {attempt.is_instructor_graded && (
            <Badge tone="green" title="Evaluated by instructor">
              {strings.gradingBadges.instructor_graded}
            </Badge>
          )}
          {!attempt.is_instructor_graded && attempt.is_ai_graded && (
            <Badge tone="blue" title="Evaluated by AI">
              {strings.gradingBadges.ai_graded}
            </Badge>
          )}
        </div>
      </td>
      <td>{formatDateTime(attempt.started_at)}</td>
      <td>
        {attempt.raw_score && attempt.max_score
          ? `${attempt.raw_score} / ${attempt.max_score}`
          : "—"}
      </td>
      <td>{attempt.band_label ?? "—"}</td>
      <td className="table-actions">
        {attempt.status === "ready" || attempt.status === "in_progress" ? (
          <Link
            to={attemptTargetUrl(attempt)}
            aria-label={strings.resumeTest}
            data-tooltip={strings.resumeTest}
          >
            <Icon name="module" />
          </Link>
        ) : (
          <Link
            to={`/student/attempts/${attempt.id}/result`}
            aria-label={strings.viewResult}
            data-tooltip={strings.viewResult}
          >
            <Icon name="overview" />
          </Link>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {error && (
        <div className="notice-line" style={{ marginBottom: 16 }}>
          <p className="error-text">{error}</p>
          <Button type="button" variant="text" className="button-link secondary" onClick={() => void loadAttempts(true)}>
            {strings.retry}
          </Button>
        </div>
      )}

      <div className="filter-bar" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <SearchableSelect
          options={[
            { value: "all", label: "All Statuses" },
            { value: "ready", label: strings.statusLabels.ready },
            { value: "in_progress", label: strings.statusLabels.in_progress },
            { value: "submitted", label: strings.statusLabels.submitted },
            { value: "grading", label: strings.statusLabels.grading },
            { value: "graded", label: strings.statusLabels.graded },
            { value: "expired", label: strings.statusLabels.expired },
          ]}
          value={selectedStatus}
          onChange={(val) => setSelectedStatus(String(val))}
          placeholder="Filter by status"
          searchable={false}
          className="status-filter-select"
        />
        <SearchableSelect
          options={[
            { value: "all", label: strings.gradingFilterLabels.all },
            { value: "ai_graded", label: strings.gradingFilterLabels.ai_graded },
            { value: "instructor_requested", label: strings.gradingFilterLabels.instructor_requested },
            { value: "pending_grading", label: strings.gradingFilterLabels.pending_grading },
            { value: "instructor_graded", label: strings.gradingFilterLabels.instructor_graded },
          ]}
          value={selectedGradingType}
          onChange={(val) => setSelectedGradingType(String(val))}
          placeholder={strings.gradingPlaceholder}
          searchable={false}
          className="grading-filter-select"
        />
        {refreshing && <span className="text-secondary text-sm">{strings.refreshing}</span>}
      </div>

      {attempts.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : filteredAttempts.length === 0 ? (
        <div className="empty-state">
          <h2>{strings.emptyFiltered.title}</h2>
          <p>{strings.emptyFiltered.description}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{strings.table.module}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.started}</th>
                <th>{strings.table.score}</th>
                <th>{strings.table.band}</th>
                <th className="table-actions-heading">{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {today.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={6}>Today</td>
                  </tr>
                  {today.map(renderRow)}
                </>
              )}
              {yesterday.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={6}>Yesterday</td>
                  </tr>
                  {yesterday.map(renderRow)}
                </>
              )}
              {older.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={6}>Older Attempts</td>
                  </tr>
                  {older.map(renderRow)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
