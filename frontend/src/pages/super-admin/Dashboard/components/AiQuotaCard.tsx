import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Checkbox, Modal } from "@/components/ui";
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
  };
  series: { hour: string; requests: number; tokens: number; failed: number }[];
  day_started_at: string;
  limits_declared: boolean;
  limits_note: string;
}

const LIMIT_FIELDS = [
  { field: "rpm" as const, label: "Requests per minute", short: "RPM", usage: (k: QuotaKey) => k.requests_last_minute },
  { field: "tpm" as const, label: "Tokens per minute", short: "TPM", usage: (k: QuotaKey) => k.tokens_last_minute },
  { field: "rpd" as const, label: "Requests per day", short: "RPD", usage: (k: QuotaKey) => k.requests_today },
];

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
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

/** Requests per hour over the last day, with failures stacked on top. */
function UsageSparkline({ series }: { series: QuotaSummary["series"] }) {
  if (series.length === 0) return null;
  const peak = Math.max(...series.map((point) => point.requests), 1);
  return (
    <div className="ai-quota-spark" aria-label="AI requests per hour over the last day">
      {series.map((point) => (
        <div
          key={point.hour}
          className="ai-quota-spark-col"
          title={`${formatDateTime(point.hour)} — ${point.requests} request${point.requests === 1 ? "" : "s"}, ${point.failed} failed`}
        >
          <span className="ai-quota-spark-failed" style={{ height: `${(point.failed / peak) * 100}%` }} />
          <span className="ai-quota-spark-ok" style={{ height: `${((point.requests - point.failed) / peak) * 100}%` }} />
        </div>
      ))}
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

  return (
    <>
      <section className="chart-card ai-quota-card">
        <div className="ai-quota-head">
          <div>
            <span className="page-eyebrow">AI marking</span>
            <h3>Quota across your keys</h3>
          </div>
          <Badge tone={!data.enabled ? "gray" : worst !== null && worst >= 90 ? "red" : data.totals.rate_limited_today ? "amber" : "green"}>
            {!data.enabled ? "Switched off" : worst !== null && worst >= 90 ? "Near limit" : data.totals.rate_limited_today ? "Hit limits today" : "Healthy"}
          </Badge>
        </div>

        <div className="ai-quota-figures">
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
        </div>

        <UsageSparkline series={data.series} />

        <div className="ai-quota-keys">
          {data.keys.slice(0, 3).map((key) => (
            <div key={key.key} className="ai-quota-key-row">
              <span className="ai-quota-key-name">{key.key}</span>
              <span className="ai-quota-key-figure">
                {key.limits.rpd ? `${key.requests_today} / ${key.limits.rpd} today` : `${key.requests_today} today`}
              </span>
              <UsageBar percent={key.usage_percent.rpd} />
            </div>
          ))}
          {data.keys.length === 0 && <p className="hint">No AI marking has run yet.</p>}
        </div>

        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setOpen(true)}>
          Full quota breakdown
        </button>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="AI marking quota">
        <div className="ai-quota-detail">
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="success-text">{notice}</p>}

          <section className="ai-quota-switch-row">
            <label className="toggle-row">
              <Checkbox
                checked={data.enabled}
                disabled={busy}
                onChange={(event) => void toggleMarking(event.target.checked)}
              />
              <span>
                <strong>Use AI marking</strong>
                <small>
                  Off sends every Writing and Speaking answer straight to its instructor queue, and stops anything
                  already queued from calling the provider.
                </small>
              </span>
            </label>
          </section>

          <p className="ai-quota-note">{data.limits_note}</p>
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

              {LIMIT_FIELDS.map(({ field, label, short, usage }) => (
                <div key={field} className="ai-quota-metric">
                  <div className="ai-quota-metric-head">
                    <span>
                      {label} <code>{short}</code>
                    </span>
                    <span>
                      {compact(usage(key))}
                      {key.limits[field] ? ` / ${compact(key.limits[field] as number)}` : " used"}
                      {key.usage_percent[field] !== null ? ` · ${key.usage_percent[field]}%` : ""}
                    </span>
                  </div>
                  <UsageBar percent={key.usage_percent[field]} />
                  <input
                    type="number"
                    min={0}
                    className="ai-quota-limit-input"
                    placeholder={`Your ${short} limit from AI Studio`}
                    value={limitDraft[key.key]?.[field] ?? ""}
                    onChange={(event) =>
                      setLimitDraft((current) => ({
                        ...current,
                        [key.key]: { ...current[key.key], [field]: event.target.value },
                      }))
                    }
                  />
                </div>
              ))}

              <p className="ai-quota-note">
                {key.requests_today} request{key.requests_today === 1 ? "" : "s"} today · {compact(key.tokens_today)} tokens ·{" "}
                {key.failed_today} failed, of which {key.rate_limited_today} were rate limits.
              </p>
            </section>
          ))}

          <div className="form-actions">
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => void saveLimits()} disabled={busy}>
              Save limits
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
