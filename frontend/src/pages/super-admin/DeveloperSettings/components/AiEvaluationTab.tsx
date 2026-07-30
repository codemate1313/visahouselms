import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { Checkbox, SearchableSelect } from "@/components/ui";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";
import { Icon } from "@/components/icons";

export function AiEvaluationTab() {
  const [form, setForm] = useState({
    enabled: false,
    provider: "gemini",
    endpoint_url: "",
    api_key: "",
    model: "gemini-2.0-flash",
    monthly_limit: 1500,
  });
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.ai;

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/ai-evaluation").then(({ data }) => {
      setConfigured(data.configured);
      setForm({
        enabled: data.enabled ?? true,
        provider: data.provider ?? "gemini",
        endpoint_url: data.endpoint_url ?? "",
        api_key: data.api_key ?? "",
        model: data.model ?? "gemini-2.0-flash",
        monthly_limit: data.monthly_limit ?? 1500,
      });
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        ...form,
        endpoint_url: form.provider === "gemini" ? undefined : form.endpoint_url,
      };
      const { data } = await apiClient.put("/super-admin/dev-settings/ai-evaluation", payload);
      setConfigured(data.configured);
      setNotice("AI settings updated successfully!");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  const isMaskedKey = Boolean(form.api_key && form.api_key.includes("*"));

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={t.title}
        description="Configure Google Gemini 1.5/2.0 Flash or Custom Evaluator for automatic Writing & Speaking scoring."
        badge={<span className={`badge ${configured ? "badge-green" : "badge-gray"}`}>{configured ? t.readyBadge : t.notConfiguredBadge}</span>}
      >
        <label className="toggle-row">
          <Checkbox checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          <span>{t.enableLabel}</span>
        </label>
        
        <div className="form-grid">
          <div>
            <label>AI Evaluation Provider</label>
            <SearchableSelect
              ariaLabel="AI Evaluation Provider"
              options={[
                { value: "gemini", label: "Google Gemini (Writing + Speaking Audio)" },
                { value: "custom_json", label: "Custom HTTP JSON Endpoint" },
              ]}
              searchable={false}
              value={form.provider}
              onChange={(value) => setForm({ ...form, provider: String(value) })}
            />
          </div>
          <div>
            <label>{t.modelLabel}</label>
            <input
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              placeholder="gemini-2.0-flash"
            />
          </div>
          {form.provider === "custom_json" && (
            <div>
              <label>{t.endpointLabel}</label>
              <input
                type="url"
                value={form.endpoint_url}
                onChange={(event) => setForm({ ...form, endpoint_url: event.target.value })}
                placeholder={t.endpointPlaceholder}
              />
            </div>
          )}
          <div>
            <label>{t.monthlyLimitLabel}</label>
            <input
              type="number"
              min="0"
              value={form.monthly_limit}
              onChange={(event) => setForm({ ...form, monthly_limit: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 mb-1">
          <label className="m-0 font-bold">{form.provider === "gemini" ? "Google Gemini API Key" : t.apiKeyLabel}</label>
          {isMaskedKey && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
              <Icon name="check" /> {t.apiKeyActiveBadge}
            </span>
          )}
        </div>
        
        <PasswordInput
          value={form.api_key}
          onChange={(event) => setForm({ ...form, api_key: event.target.value })}
          placeholder="Enter API key (e.g. AQ.Ab8RN6...)"
        />

        {isMaskedKey && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            🔒 <strong>Security Note:</strong> Your API key is active and encrypted at rest in the database. For security compliance, saved secrets are masked as <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">********</code> when loaded. To update or replace it, type your new API key.
          </p>
        )}

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
        <div className="form-actions">
          <button disabled={busy}>{busy ? t.saveBusy : t.saveLabel}</button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
