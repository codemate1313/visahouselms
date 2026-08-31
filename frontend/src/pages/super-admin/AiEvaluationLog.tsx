import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Modal, SearchInput, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";

function formatLogDateTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * The AI marking trail, written for a reader who does not work on the code.
 *
 * One row is one conversation with a provider: the answer we sent it, what it
 * said, how long it took, and - when it failed - what that means and what to
 * do about it. The plain-language wording comes from the backend
 * (`ai_log_service`) so the table row and the detail agree.
 */

interface AiEvaluationRow {
  id: number;
  status: "completed" | "failed" | "running";
  status_label: string;
  student_name: string;
  student_email: string | null;
  attempt_id: number;
  module_title: string;
  part_title: string;
  skill: string | null;
  provider: string;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  summary: string;
}

interface AiEvaluationDetail extends AiEvaluationRow {
  asked: {
    criteria: { criterion: string; max_marks: string }[];
    submissions: { prompt: string | null; description: string }[];
    skill_focus: string | null;
    key_label: string | null;
    recorded: boolean;
  };
  answered: {
    scores: { criterion: string; marks: string; level: string | null; reason: string | null }[];
    comment: string | null;
    confidence: string | null;
    raw: string | null;
  };
  failure: { what_happened: string; what_to_do: string; technical_detail: string } | null;
}

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Marked", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "In progress", value: "running" },
];

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function StatusPill({ status, label }: { status: AiEvaluationRow["status"]; label: string }) {
  const tone = status === "completed" ? "ai-log-pill-ok" : status === "failed" ? "ai-log-pill-failed" : "ai-log-pill-running";
  return <span className={`ai-log-pill ${tone}`}>{label}</span>;
}

export function AiEvaluationLog({ onCountChange }: { onCountChange?: (count: number | null) => void }) {
  const [rows, setRows] = useState<AiEvaluationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AiEvaluationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<{ items: AiEvaluationRow[]; total: number }>(
        "/super-admin/logs/ai-evaluations",
        {
          params: {
            search: searchRef.current.trim() || undefined,
            status_filter: statusFilter || undefined,
            page_size: 50,
          },
        },
      );
      setRows(data.items);
      onCountChange?.(data.total);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load AI evaluations."));
      onCountChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const { data } = await apiClient.get<AiEvaluationDetail>(`/super-admin/logs/ai-evaluations/${id}`);
      setSelected(data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to open this evaluation."));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <div className="logs-filter-toolbar">
        <SegmentedControl
          ariaLabel="Evaluation outcome"
          onChange={setStatusFilter}
          options={STATUS_FILTERS}
          size="sm"
          value={statusFilter}
        />
        <div className="logs-filter-actions">
          <SearchInput
            className="logs-search-input"
            width={320}
            value={search}
            onChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
            placeholder="Search student, model, or error..."
          />
          <Button type="button" variant="secondary" className="button secondary logs-refresh-btn" onClick={() => void load()}>
            <Icon name="terminal" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div className="logs-loading-card">
          <span className="logs-spinner" />
          <p className="hint">Loading AI evaluations...</p>
        </div>
      ) : (
        <div className="table-wrap logs-table-card">
          <table className="data-table sleek-logs-table">
            <thead>
              <tr>
                <th className="th-id">ID</th>
                <th className="th-status">Outcome</th>
                <th className="th-actor">Student</th>
                <th className="th-endpoint">Test &amp; part</th>
                <th className="th-message">What happened</th>
                <th className="th-latency">Took</th>
                <th className="th-time">When</th>
                <th className="th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    No AI evaluations yet. They appear here as soon as a Writing or Speaking answer is sent for AI marking.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="log-row-clickable"
                  tabIndex={0}
                  role="button"
                  aria-label={`View AI evaluation #${row.id}`}
                  onClick={() => void openDetail(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(row.id);
                    }
                  }}
                >
                  <td className="col-log-id"><span className="log-id-pill">#{row.id}</span></td>
                  <td className="col-log-status"><StatusPill status={row.status} label={row.status_label} /></td>
                  <td className="col-log-actor">
                    <div className="log-actor-group">
                      <span className="log-user-name">{row.student_name}</span>
                      {row.student_email && <span className="log-user-email">{row.student_email}</span>}
                    </div>
                  </td>
                  <td className="col-log-endpoint">
                    <div className="ai-log-target">
                      <span className="ai-log-module">{row.module_title}</span>
                      <span className="ai-log-part">{row.part_title}</span>
                    </div>
                  </td>
                  <td className="col-log-message">
                    <span className="ai-log-summary-text">{row.summary}</span>
                  </td>
                  <td className="col-log-latency">
                    <span
                      className={`log-latency-tag ${
                        (row.duration_ms ?? 0) > 30000 ? "slow" : (row.duration_ms ?? 0) > 10000 ? "moderate" : "fast"
                      }`}
                    >
                      {formatDuration(row.duration_ms)}
                    </span>
                  </td>
                  <td className="col-log-time">{formatLogDateTime(row.created_at)}</td>
                  <td className="col-log-action">
                    <Button
                      type="button"
                      size="sm"
                      className="log-view-btn"
                      disabled={detailLoading}
                      onClick={(event) => {
                        event.stopPropagation();
                        void openDetail(row.id);
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected ? `AI evaluation #${selected.id}` : "AI evaluation"}
      >
        {selected && (
          <div className="log-detail-dialog ai-log-detail">
            <div className="log-detail-summary-bar">
              <div className="log-detail-summary-pill">
                <span className="summary-pill-label">Outcome</span>
                <StatusPill status={selected.status} label={selected.status_label} />
              </div>
              <div className="log-detail-summary-pill">
                <span className="summary-pill-label">Time taken</span>
                <span className="log-latency-tag">{formatDuration(selected.duration_ms)}</span>
              </div>
              <div className="log-detail-summary-pill">
                <span className="summary-pill-label">AI used</span>
                <code>{selected.model || selected.provider}</code>
              </div>
              <div className="log-detail-summary-pill">
                <span className="summary-pill-label">When</span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatLogDateTime(selected.created_at)}</span>
              </div>
            </div>

            <p className="ai-log-headline">{selected.summary}</p>

            {selected.failure && (
              <section className="ai-log-card is-failure">
                <h3>What went wrong</h3>
                <p className="ai-log-lead">{selected.failure.what_happened}</p>
                <p className="ai-log-advice">{selected.failure.what_to_do}</p>
                <details className="ai-log-details">
                  <summary>Technical detail</summary>
                  <pre className="log-console-box">{selected.failure.technical_detail}</pre>
                </details>
              </section>
            )}

            <section className="ai-log-card">
              <h3>What we asked the AI to do</h3>
              {selected.asked.recorded ? (
                <>
                  <p className="ai-log-lead">
                    Mark this student's {selected.skill || "submitted"} answer for{" "}
                    <strong>{selected.part_title}</strong> in <strong>{selected.module_title}</strong>.
                  </p>
                  {selected.asked.skill_focus && (
                    <p className="ai-log-note">This part tests: {selected.asked.skill_focus}</p>
                  )}
                  {selected.asked.submissions.length > 0 && (
                    <ul className="ai-log-list">
                      {selected.asked.submissions.map((item, index) => (
                        <li key={index}>
                          <strong>{item.description}</strong>
                          {item.prompt ? <span className="ai-log-prompt"> — for: “{item.prompt}”</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.asked.criteria.length > 0 && (
                    <>
                      <p className="ai-log-note">Score it against these criteria:</p>
                      <ul className="ai-log-chip-list">
                        {selected.asked.criteria.map((item) => (
                          <li key={item.criterion}>
                            {item.criterion} <span>max {item.max_marks}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {selected.asked.key_label && (
                    <p className="ai-log-note">Sent with the “{selected.asked.key_label}” API key.</p>
                  )}
                </>
              ) : (
                <p className="ai-log-note">
                  This evaluation ran before the platform started recording request details, so only the outcome is available.
                </p>
              )}
            </section>

            <section className="ai-log-card">
              <h3>What the AI sent back</h3>
              {selected.answered.scores.length > 0 ? (
                <>
                  <div className="table-wrap">
                    <table className="data-table ai-log-score-table">
                      <thead>
                        <tr>
                          <th>Criterion</th>
                          <th>Marks</th>
                          <th>Level</th>
                          <th>Why it gave that mark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.answered.scores.map((score) => (
                          <tr key={score.criterion}>
                            <td><strong>{score.criterion}</strong></td>
                            <td className="ai-log-marks">{score.marks}</td>
                            <td>{score.level || "—"}</td>
                            <td>{score.reason || "No reason given."}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selected.answered.comment && (
                    <>
                      <p className="ai-log-note">Overall comment from the AI:</p>
                      <p className="ai-log-quote">{selected.answered.comment}</p>
                    </>
                  )}
                  {selected.answered.confidence && (
                    <p className="ai-log-note">
                      How sure the AI said it was: {Math.round(Number(selected.answered.confidence) * 100)}%. Every AI
                      mark stays a draft until an instructor confirms it.
                    </p>
                  )}
                </>
              ) : (
                <p className="ai-log-note">The AI did not return any marks for this request.</p>
              )}
              {selected.answered.raw && (
                <details className="ai-log-details">
                  <summary>Exact reply from the AI</summary>
                  <pre className="log-console-box">{selected.answered.raw}</pre>
                </details>
              )}
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
