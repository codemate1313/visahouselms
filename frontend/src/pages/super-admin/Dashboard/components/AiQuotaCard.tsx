import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Modal } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/utils/date";

/**
 * AI marking quota at a glance, and the switch that turns it off.
 *
 * Usage is measured from our own evaluation records - Google publishes no
 * endpoint that reports your limits or your consumption, so the ceilings are
 * whatever a super admin typed in from AI Studio. The card says so rather than
 * implying it is reading live quota.
 */

interface QuotaKey {
  key: string;
  provider?: string;
  model?: string | null;
  enabled: boolean;
  requests_last_minute: number;
  requests_last_hour: number;
  requests_today: number;
  tokens_last_minute: number;
  tokens_today: number;
  failed_today: number;
  rate_limited_today: number;
  not_sent_today: number;
  limits: { rpm: number | null; tpm: number | null; rpd: number | null };
  usage_percent: { rpm: number | null; tpm: number | null; rpd: number | null };
}

interface QuotaSummary {
  enabled: boolean;
  configured: boolean;
  keys: QuotaKey[];
  totals: {
    requests_last_minute: number;
    requests_today: number;
    tokens_today: number;
    failed_today: number;
    rate_limited_today: number;
    not_sent_today: number;
  };
  queue?: {
    pending: number;
    running: number;
    failed_today: number;
  };
  performance?: {
    average_duration_ms: number | null;
    slowest_duration_ms: number | null;
    timeout_failures_today: number;
    last_success: {
      provider?: string | null;
      model?: string | null;
      created_at: string;
      duration_ms?: number | null;
      key?: string;
    } | null;
    last_error: {
      message?: string | null;
      provider?: string | null;
      model?: string | null;
      created_at: string;
      duration_ms?: number | null;
      key?: string;
    } | null;
  };
  series: { hour: string; requests: number; tokens: number; failed: number }[];
  day_started_at: string;
  day_resets_at: string;
  limits_declared: boolean;
  limits_note: string;
}

function getPlaceholderLimit(model: string | null | undefined, field: "rpm" | "tpm" | "rpd"): string {
  const m = (model || "").toLowerCase();
  if (m.includes("pro")) {
    if (field === "rpm") return "2";
    if (field === "tpm") return "32000";
    if (field === "rpd") return "50";
  }
  // Free-tier Flash models in AI Studio currently show the same RPM/TPM shape
  // as the model table: count per model, not just per API key.
  if (field === "rpm") return "5";
  if (field === "tpm") return "250000";
  if (field === "rpd") return "250";
  return "";
}

const LIMIT_FIELDS = [
  { field: "rpm" as const, label: "Requests per minute", short: "RPM", usage: (k: QuotaKey) => k.requests_last_minute },
  { field: "tpm" as const, label: "Tokens per minute", short: "TPM", usage: (k: QuotaKey) => k.tokens_last_minute },
  { field: "rpd" as const, label: "Requests per day", short: "RPD", usage: (k: QuotaKey) => k.requests_today },
];

/** Exact below 100k, so "1,455 left of 1,500" does not collapse into
 *  "1.5k left of 1.5k" and hide the very number the row exists to show. */
function readable(value: number): string {
  return value < 100_000 ? value.toLocaleString() : compact(value);
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function shortTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toneFor(percent: number | null): string {
  if (percent === null) return "is-unknown";
  if (percent >= 90) return "is-critical";
  if (percent >= 60) return "is-warning";
  return "is-ok";
}

function UsageBar({ percent }: { percent: number | null }) {
  return (
    <div className={`ai-quota-bar ${toneFor(percent)}`}>
      <span style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
    </div>
  );
}



export function AiQuotaCard() {
  const [data, setData] = useState<QuotaSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState<Record<string, { rpm: string; tpm: string; rpd: string }>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: summary } = await apiClient.get<QuotaSummary>(
        "/super-admin/dev-settings/ai-evaluation/quota",
        { headers: { "X-Skip-Loader": "1" } },
      );
      setData(summary);
      setLimitDraft(
        Object.fromEntries(
          summary.keys.map((key) => [
            key.key,
            {
              rpm: key.limits.rpm ? String(key.limits.rpm) : "",
              tpm: key.limits.tpm ? String(key.limits.tpm) : "",
              rpd: key.limits.rpd ? String(key.limits.rpd) : "",
            },
          ]),
        ),
      );
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not load AI quota."));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleMarking(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data: result } = await apiClient.post<{ message: string }>(
        "/super-admin/dev-settings/ai-evaluation/toggle",
        { enabled },
      );
      setNotice(result.message);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not change AI marking."));
    } finally {
      setBusy(false);
    }
  }

  async function saveLimits() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.put("/super-admin/dev-settings/ai-evaluation/quota-limits", {
        limits: Object.fromEntries(
          Object.entries(limitDraft).map(([label, values]) => [
            label,
            {
              rpm: values.rpm ? Number(values.rpm) : null,
              tpm: values.tpm ? Number(values.tpm) : null,
              rpd: values.rpd ? Number(values.rpd) : null,
            },
          ]),
        ),
      });
      setNotice("Limits saved.");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not save the limits."));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const worst = data.keys.reduce<number | null>((highest, key) => {
    const values = [key.usage_percent.rpm, key.usage_percent.tpm, key.usage_percent.rpd].filter(
      (value): value is number => value !== null,
    );
    const keyMax = values.length ? Math.max(...values) : null;
    if (keyMax === null) return highest;
    return highest === null ? keyMax : Math.max(highest, keyMax);
  }, null);

  const totalRpdLimit = data.keys.reduce((sum, key) => sum + (key.limits.rpd || 0), 0);
  const totalRequestsToday = data.totals.requests_today;
  const rawPercent = totalRpdLimit > 0 ? (totalRequestsToday / totalRpdLimit) * 100 : null;
  const dailyUsedPercent = rawPercent !== null ? Math.min(100, Math.round(rawPercent)) : null;
  const remainingToday = totalRpdLimit > 0 ? Math.max(0, totalRpdLimit - totalRequestsToday) : null;
  const queue = data.queue ?? { pending: 0, running: 0, failed_today: 0 };
  const performance = data.performance ?? {
    average_duration_ms: null,
    slowest_duration_ms: null,
    timeout_failures_today: 0,
    last_success: null,
    last_error: null,
  };
  const recentSeries = data.series.slice(-12);
  const seriesPeak = Math.max(1, ...recentSeries.map((point) => point.requests));
  const successToday = Math.max(0, data.totals.requests_today - data.totals.failed_today);
  const failurePercent = data.totals.requests_today > 0 ? Math.round(data.totals.failed_today / data.totals.requests_today * 100) : 0;

  const arcLength = 235.62;
  const effectivePct =
    dailyUsedPercent !== null
      ? Math.max(totalRequestsToday > 0 ? 3 : 0, Math.min(100, dailyUsedPercent))
      : totalRequestsToday > 0
        ? 12
        : 0;
  const gaugeOffset = arcLength * (1 - effectivePct / 100);

  const gaugeStroke =
    dailyUsedPercent === null
      ? "url(#aiGaugeGradOk)"
      : dailyUsedPercent >= 90
        ? "url(#aiGaugeGradCritical)"
        : dailyUsedPercent >= 60
          ? "url(#aiGaugeGradWarning)"
          : "url(#aiGaugeGradOk)";

  const gaugeValueText =
    dailyUsedPercent !== null
      ? rawPercent !== null && rawPercent > 0 && rawPercent < 1
        ? "<1%"
        : `${dailyUsedPercent}%`
      : `${totalRequestsToday}`;

  const gaugeSubtitleText =
    totalRpdLimit > 0
      ? remainingToday !== null && remainingToday > 0
        ? `${remainingToday} left today`
        : "Daily quota used"
      : "Requests today";

  return (
    <>
      <div
        className="clickable-chart-card-wrapper"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        aria-label="Open detailed AI quota breakdown"
      >
        <section className="chart-card reference-styled-chart ai-quota-card">
          <div className="chart-toolbar">
            <div className="chart-title-area">
              <span className="info-icon-badge"><Icon name="analytics" /></span>
              <span className="chart-tag-text">AI Marking Quota</span>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                onClick={handleRefresh}
                disabled={refreshing || busy}
                className="refresh-btn"
                label="Refresh quota status"
                icon={
                  <svg
                    className={refreshing ? "spin" : ""}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: "14px", height: "14px" }}
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
                  </svg>
                }
              />
              <Badge tone={!data.enabled ? "gray" : worst !== null && worst >= 90 ? "red" : data.totals.rate_limited_today ? "amber" : "green"}>
                {!data.enabled ? "Off" : worst !== null && worst >= 90 ? "Near limit" : data.totals.rate_limited_today ? "Hit limits" : "Healthy"}
              </Badge>
              <IconButton
                onClick={() => setOpen(true)}
                className="chart-open-detail-btn"
                label="Open full quota breakdown"
                variant="plain"
                size="sm"
                icon={<Icon name="analytics" />}
              />
            </div>
          </div>

          {/* Semi-Circular Radial Gauge */}
          <div className="ai-quota-gauge-container">
            <svg
              viewBox="0 0 240 145"
              className="ai-quota-gauge-svg"
              role="img"
              aria-label="AI Quota Gauge"
            >
              <defs>
                <linearGradient id="aiGaugeGradOk" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="aiGaugeGradWarning" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="aiGaugeGradCritical" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#b91c2b" />
                </linearGradient>
              </defs>

              {/* Background Arc Track */}
              <path
                d="M 35 110 A 85 85 0 0 1 205 110"
                fill="none"
                stroke="currentColor"
                className="ai-gauge-bg-track"
                strokeWidth="15"
                strokeLinecap="round"
              />

              {/* Active Gauge Fill */}
              <path
                d="M 35 110 A 85 85 0 0 1 205 110"
                fill="none"
                stroke={gaugeStroke}
                strokeWidth="15"
                strokeLinecap="round"
                strokeDasharray="267.04"
                strokeDashoffset={gaugeOffset}
                style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}
              />

              {/* Center Main Value */}
              <text
                x="120"
                y="85"
                textAnchor="middle"
                className="ai-gauge-center-value"
              >
                {gaugeValueText}
              </text>

              {/* Center Subtitle */}
              <text
                x="120"
                y="105"
                textAnchor="middle"
                className="ai-gauge-center-subtitle"
              >
                {gaugeSubtitleText}
              </text>

              {/* Min and Max markers */}
              <text x="35" y="132" textAnchor="middle" className="ai-gauge-tick-label">
                0%
              </text>
              <text x="205" y="132" textAnchor="middle" className="ai-gauge-tick-label">
                {totalRpdLimit > 0 ? `${compact(totalRpdLimit)}` : "100%"}
              </text>
            </svg>
          </div>

          <div className="ai-quota-ops-grid">
            <div className="ai-quota-ops-card">
              <span>Queue</span>
              <strong>{queue.pending + queue.running}</strong>
              <small>{queue.pending} pending · {queue.running} running</small>
            </div>
            <div className="ai-quota-ops-card">
              <span>Avg eval</span>
              <strong>{formatDuration(performance.average_duration_ms)}</strong>
              <small>slowest {formatDuration(performance.slowest_duration_ms)}</small>
            </div>
            <div className={`ai-quota-ops-card ${performance.timeout_failures_today ? "is-alert" : ""}`}>
              <span>Timeouts</span>
              <strong>{performance.timeout_failures_today}</strong>
              <small>{data.totals.failed_today} failed today</small>
            </div>
          </div>

          <div className="ai-quota-trend-panel">
            <div className="ai-quota-trend-head">
              <span>Last 12 hours</span>
              <b>{successToday} ok · {failurePercent}% failed</b>
            </div>
            <div className="ai-quota-trend-legend" aria-hidden="true">
              <span><i className="is-success" /> successful calls</span>
              <span><i className="is-failed" /> failed calls</span>
            </div>
            <div className="ai-quota-trend-bars" aria-label="AI request trend for the last 12 hours">
              {recentSeries.length ? (
                recentSeries.map((point) => {
                  const successful = Math.max(0, point.requests - point.failed);
                  const requestsHeight = Math.max(point.requests > 0 ? 8 : 0, Math.round(point.requests / seriesPeak * 100));
                  const successHeight = Math.max(successful > 0 ? 8 : 0, Math.round(successful / seriesPeak * 100));
                  const failedHeight = point.failed ? Math.max(6, Math.round(point.failed / seriesPeak * 100)) : 0;
                  const hourLabel = shortTime(point.hour);
                  return (
                    <span className="ai-quota-trend-column" key={point.hour}>
                      <span
                        className="ai-quota-trend-bar"
                        aria-label={`${point.requests} calls, ${successful} successful and ${point.failed} failed at ${hourLabel}`}
                      >
                        <i className="is-total" style={{ height: `${requestsHeight}%` }} />
                        {successHeight > 0 && <i className="is-success" style={{ height: `${successHeight}%` }} />}
                        {failedHeight > 0 && <em style={{ height: `${failedHeight}%` }} />}
                      </span>
                      <small>{hourLabel}</small>
                    </span>
                  );
                })
              ) : (
                <span className="ai-quota-empty-trend">No provider calls in this window</span>
              )}
            </div>
          </div>

          <div className="ai-quota-status-row">
            <span>Last success: {performance.last_success ? shortTime(performance.last_success.created_at) : "none today"}</span>
            <span>Last error: {performance.last_error?.message ? performance.last_error.message : "none today"}</span>
          </div>
        </section>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="AI marking quota & capacity">
        <div className="ai-quota-detail">
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="success-text">{notice}</p>}

          {/* Quick Metrics Strip inside Modal */}
          <div className="ai-quota-figures" style={{ marginBottom: "20px" }}>
            <div>
              <b>{data.totals.requests_today}</b>
              <span>requests today</span>
            </div>
            <div>
              <b>{compact(data.totals.tokens_today)}</b>
              <span>tokens today</span>
            </div>
            <div>
              <b>{data.totals.rate_limited_today}</b>
              <span>rate-limited</span>
            </div>
            <div>
              <b>{data.totals.failed_today}</b>
              <span>failed today</span>
            </div>
          </div>

          <section className="ai-quota-switch-row">
            <div className="toggle-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ marginRight: "16px" }}>
                <strong style={{ display: "block", fontSize: "14px" }}>Use AI marking</strong>
                <small style={{ display: "block", marginTop: "4px", fontSize: "12px", lineHeight: "1.4", color: "var(--text-muted)" }}>
                  Off sends every Writing and Speaking answer straight to its instructor queue, and stops anything
                  already queued from calling the provider.
                </small>
              </span>
              <label className="ai-switch-toggle" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={data.enabled}
                  disabled={busy}
                  onChange={(event) => void toggleMarking(event.target.checked)}
                />
                <span className="ai-switch-slider" />
              </label>
            </div>
          </section>

          <p className="ai-quota-note">
            {data.limits_note} Until you enter one, the bars use the standard free-tier figure for the model as an
            assumption - the used counts are always real.
          </p>
          <p className="ai-quota-note">
            The day counter follows Google's reset at midnight Pacific — this one started {formatDateTime(data.day_started_at)}.
          </p>

          {data.keys.map((key) => (
            <section key={key.key} className="ai-quota-key-card">
              <header>
                <h4>{key.key}</h4>
                <span>
                  {key.model || key.provider || "—"}
                  {key.enabled ? "" : " · disabled"}
                </span>
              </header>

              {LIMIT_FIELDS.map(({ field, label, short, usage }) => {
                const used = usage(key);
                const defaultLimitStr = getPlaceholderLimit(key.model, field);
                const userLimitStr = limitDraft[key.key]?.[field] ?? "";
                
                // Calculate dynamic percentage: fallback to placeholder limits if no custom ceiling is entered
                const effectiveLimit = userLimitStr ? Number(userLimitStr) : (key.limits[field] || (defaultLimitStr ? Number(defaultLimitStr) : null));
                const pct = effectiveLimit && effectiveLimit > 0 ? Math.round((used / effectiveLimit) * 100) : null;
                
                const remaining = effectiveLimit !== null ? Math.max(0, effectiveLimit - used) : null;
                const assumed = !userLimitStr && !key.limits[field];

                return (
                  <div key={field} className="ai-quota-metric">
                    <div className="ai-quota-metric-head">
                      <span className="ai-quota-metric-label">
                        {label} <code className="ai-quota-code-chip">{short}</code>
                      </span>
                      <span className="ai-quota-metric-reading">
                        {remaining !== null ? (
                          <>
                            <b>{readable(remaining)}</b> left of {readable(effectiveLimit as number)}
                            {pct !== null ? (
                              <span className={`ai-quota-pct-chip ${toneFor(pct)}`}>{pct}% used</span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <b>{readable(used)}</b> used · no limit set
                          </>
                        )}
                      </span>
                    </div>
                    <UsageBar percent={pct} />
                    <div className="ai-quota-metric-foot">
                      <span>
                        {readable(used)} used{field === "rpd" ? ` today · resets ${formatDateTime(data.day_resets_at)}` : " in the last minute"}
                        {assumed ? " · limit assumed, not confirmed" : ""}
                      </span>
                      <label className="ai-quota-limit-field">
                        Your {short} limit
                        <input
                          type="number"
                          min={0}
                          className="ai-quota-limit-inline-input"
                          placeholder={defaultLimitStr ? compact(Number(defaultLimitStr)) : "No limit"}
                          value={limitDraft[key.key]?.[field] ?? ""}
                          onChange={(event) =>
                            setLimitDraft((current) => ({
                              ...current,
                              [key.key]: { ...current[key.key], [field]: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              <p className="ai-quota-note">
                {key.requests_today} request{key.requests_today === 1 ? "" : "s"} sent today · {compact(key.tokens_today)} tokens ·{" "}
                {key.failed_today} failed, of which {key.rate_limited_today} were rate limits.
                {key.not_sent_today > 0
                  ? ` A further ${key.not_sent_today} answer${key.not_sent_today === 1 ? " was" : "s were"} settled without calling the AI (empty answers score zero), so they used no quota.`
                  : ""}
              </p>
              {key.key === "Before per-key tracking" && (
                <p className="ai-quota-note">
                  Evaluations recorded before the platform tracked which key paid for each call. Nothing new is added here.
                </p>
              )}
            </section>
          ))}

          <div className="form-actions">
            <Button type="button" onClick={() => void saveLimits()} disabled={busy}>
              Save limits
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
