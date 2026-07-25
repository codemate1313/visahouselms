import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { Checkbox } from "@/components/ui";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function AiEvaluationTab() {
  const [form, setForm] = useState({ enabled: false, provider: "custom_json", endpoint_url: "", api_key: "", model: "", monthly_limit: 100 });
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.ai;

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/ai-evaluation").then(({ data }) => {
      setConfigured(data.configured);
      setForm({
        enabled: data.enabled,
        provider: data.provider ?? "custom_json",
        endpoint_url: data.endpoint_url ?? "",
        api_key: data.api_key ?? "",
        model: data.model ?? "",
        monthly_limit: data.monthly_limit ?? 100,
      });
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await apiClient.put("/super-admin/dev-settings/ai-evaluation", form);
      setConfigured(data.configured);
      setNotice(t.savedNotice);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={t.title}
        description={t.description}
        badge={<span className={`badge ${configured ? "badge-green" : "badge-gray"}`}>{configured ? t.readyBadge : t.notConfiguredBadge}</span>}
      >
        <label className="toggle-row">
          <Checkbox checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          <span>{t.enableLabel}</span>
        </label>
        <div className="form-grid">
          <div>
            <label>{t.providerLabel}</label>
            <input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} />
          </div>
          <div>
            <label>{t.modelLabel}</label>
            <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
          </div>
          <div>
            <label>{t.endpointLabel}</label>
            <input type="url" value={form.endpoint_url} onChange={(event) => setForm({ ...form, endpoint_url: event.target.value })} placeholder={t.endpointPlaceholder} />
          </div>
          <div>
            <label>{t.monthlyLimitLabel}</label>
            <input type="number" min="0" value={form.monthly_limit} onChange={(event) => setForm({ ...form, monthly_limit: Number(event.target.value) })} />
          </div>
        </div>
        <label>{t.apiKeyLabel}</label>
        <PasswordInput value={form.api_key} onChange={(event) => setForm({ ...form, api_key: event.target.value })} placeholder={t.apiKeyPlaceholder} />
        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
        <div className="form-actions">
          <button disabled={busy}>{busy ? t.saveBusy : t.saveLabel}</button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
