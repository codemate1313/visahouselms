import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Checkbox, SearchableSelect } from "@/components/ui";
import { AiKeyPriorityManager, type AiKeyConfig } from "../../components/AiKeyPriorityManager";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

type AiProvider = "gemini" | "openai" | "custom_json";

interface AiEvaluationForm {
  enabled: boolean;
  provider: AiProvider;
  endpoint_url: string;
  api_key: string;
  api_keys: AiKeyConfig[];
  model: string;
}

function hydrateApiKeys(data: Partial<AiEvaluationForm>): AiKeyConfig[] {
  if (Array.isArray(data.api_keys) && data.api_keys.length > 0) {
    return data.api_keys;
  }
  if (!data.api_key) {
    return [];
  }
  return [{
    id: "legacy",
    label: "Primary API Key",
    provider: data.provider === "custom_json" || data.provider === "openai" ? data.provider : "gemini",
    model: data.model || "gemini-2.0-flash",
    endpoint_url: data.endpoint_url || "",
    api_key: data.api_key,
    enabled: true,
    priority: 1,
    last_status: null,
    last_checked_at: null,
    info: null,
  }];
}

export function AiEvaluationTab() {
  const [form, setForm] = useState<AiEvaluationForm>({
    enabled: false,
    provider: "gemini",
    endpoint_url: "",
    api_key: "",
    api_keys: [],
    model: "gemini-2.0-flash",
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
        provider: data.provider === "custom_json" || data.provider === "openai" ? data.provider : "gemini",
        endpoint_url: data.endpoint_url ?? "",
        api_key: data.api_key ?? "",
        api_keys: hydrateApiKeys(data),
        model: data.model ?? "gemini-2.0-flash",
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
        api_key: form.api_key && !form.api_key.includes("*") ? form.api_key : undefined,
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
                { value: "openai", label: "OpenAI (Writing + Speaking Audio)" },
                { value: "custom_json", label: "Custom HTTP JSON Endpoint" },
              ]}
              searchable={false}
              value={form.provider}
              onChange={(value) => setForm({ ...form, provider: value === "custom_json" || value === "openai" ? value : "gemini" })}
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
        </div>

        <AiKeyPriorityManager
          keys={form.api_keys}
          onChange={(api_keys) => setForm({ ...form, api_keys })}
          provider={form.provider}
          model={form.model}
          endpointUrl={form.endpoint_url}
          testPath="/super-admin/dev-settings/ai-evaluation/test-key"
        />

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
        <div className="form-actions">
          <button disabled={busy}>{busy ? t.saveBusy : t.saveLabel}</button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
