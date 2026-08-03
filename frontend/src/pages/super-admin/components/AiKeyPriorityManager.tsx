import { useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui";

export interface AiKeyConfig {
  id: string;
  label: string;
  provider: AiDetectedProvider;
  model: string;
  endpoint_url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  last_status?: "ok" | "failed" | null;
  last_checked_at?: string | null;
  info?: string | null;
  model_options?: ModelOption[];
}

type AiProviderSelection = "gemini" | "openai" | "custom_json" | "disabled";
type AiDetectedProvider = "gemini" | "custom_json" | "openai" | "anthropic" | "unknown";

const providerOptions: Array<{ value: AiDetectedProvider; label: string; supported: boolean }> = [
  { value: "gemini", label: "Google Gemini", supported: true },
  { value: "custom_json", label: "Custom JSON", supported: true },
  { value: "openai", label: "OpenAI", supported: true },
  { value: "anthropic", label: "Anthropic Claude (detected, unsupported)", supported: false },
  { value: "unknown", label: "Unknown provider", supported: false },
];

interface ModelOption {
  value: string;
  label: string;
}

interface TestResult {
  ok: boolean;
  provider: string;
  provider_label?: string;
  detected_provider?: string;
  model: string;
  model_options?: ModelOption[];
  key_preview: string | null;
  latency_ms: number;
  supported?: boolean;
  message: string;
  detection_message?: string;
}

interface AiKeyPriorityManagerProps {
  keys: AiKeyConfig[];
  onChange: (keys: AiKeyConfig[]) => void;
  provider: AiProviderSelection;
  model: string;
  endpointUrl: string;
  testPath: string;
}

function newKey(index: number, provider: AiProviderSelection, model: string, endpointUrl: string): AiKeyConfig {
  return {
    id: `key-${Date.now()}-${index}`,
    label: `API Key ${index + 1}`,
    provider: provider === "disabled" ? "gemini" : provider,
    model,
    endpoint_url: endpointUrl,
    api_key: "",
    enabled: true,
    priority: index + 1,
    last_status: null,
    last_checked_at: null,
    info: null,
  };
}

function reorder(keys: AiKeyConfig[]) {
  return keys.map((key, index) => ({ ...key, priority: index + 1 }));
}

function isInteractiveDragTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, button, a"));
}

function detectProviderFromInput(apiKey: string, endpointUrl: string): AiDetectedProvider | null {
  const secret = apiKey.trim();
  const endpoint = endpointUrl.trim();

  if (secret.startsWith("AIza")) return "gemini";
  if (secret.startsWith("sk-ant-")) return "anthropic";
  if (secret.startsWith("sk-proj-") || secret.startsWith("sk-")) return "openai";
  if (endpoint) {
    try {
      const host = new URL(endpoint).host.toLowerCase();
      return host.includes("generativelanguage.googleapis.com") ? "gemini" : "custom_json";
    } catch {
      return "custom_json";
    }
  }
  if (secret.length >= 12 && !secret.includes("*")) return "unknown";
  return null;
}

function providerInfo(provider: AiDetectedProvider) {
  return providerOptions.find((option) => option.value === provider) ?? providerOptions[4];
}

function defaultModelForProvider(provider: AiDetectedProvider, fallback: string) {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "gemini") return "gemini-2.0-flash";
  if (provider === "custom_json") return fallback;
  return "";
}

function modelMatchesProvider(provider: AiDetectedProvider, model: string) {
  if (!model) return false;
  if (provider === "gemini") return model.startsWith("gemini-");
  if (provider === "openai") {
    return ["gpt-5", "gpt-4.1", "gpt-4o", "o4", "o3"].some((prefix) => model.startsWith(prefix));
  }
  if (provider === "custom_json") return true;
  return false;
}

function isMaskedSecret(value: string) {
  return Boolean(value) && value.split("").every((char) => char === "*");
}

export function AiKeyPriorityManager({
  keys,
  onChange,
  provider,
  model,
  endpointUrl,
  testPath,
}: AiKeyPriorityManagerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = keys.length ? keys : [newKey(0, provider, model, endpointUrl)];

  function update(index: number, patch: Partial<AiKeyConfig>) {
    onChange(reorder(rows.map((key, rowIndex) => (rowIndex === index ? { ...key, ...patch } : key))));
  }

  function add() {
    onChange(reorder([...rows, newKey(rows.length, provider, model, endpointUrl)]));
  }

  function remove(index: number) {
    onChange(reorder(rows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(reorder(next));
  }

  async function testKey(index: number) {
    const key = rows[index];
    setTestingId(key.id);
    setError(null);
    try {
      const { data } = await apiClient.post<TestResult>(testPath, {
        key_id: key.id,
        provider: "auto",
        preferred_provider: key.provider || provider,
        model: key.model || model,
        endpoint_url: key.endpoint_url || endpointUrl || undefined,
        api_key: key.api_key,
      });
      const detectedProvider = data.detected_provider || data.provider;
      const providerPatch = providerOptions.some((option) => option.value === detectedProvider)
        ? { provider: detectedProvider as AiKeyConfig["provider"] }
        : {};
      update(index, {
        ...providerPatch,
        model: data.model || data.model_options?.[0]?.value || key.model || model,
        model_options: data.model_options || [],
        last_status: data.ok ? "ok" : "failed",
        last_checked_at: new Date().toISOString(),
        info: `${data.provider_label ? `${data.provider_label}: ` : ""}${data.message}${data.detection_message ? ` ${data.detection_message}` : ""}${data.latency_ms ? ` (${data.latency_ms} ms)` : ""}`,
      });
    } catch (err: unknown) {
      const message = extractErrorMessage(err, "Connection test failed.");
      update(index, {
        last_status: "failed",
        last_checked_at: new Date().toISOString(),
        info: message,
      });
      setError(message);
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section className="workspace-panel" style={{ marginTop: 20 }}>
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">Failover priority</span>
          <h2>API key priority</h2>
          <p>Drag keys into the order the evaluator should try them. Failed keys are skipped automatically at runtime.</p>
        </div>
        <button type="button" className="secondary" onClick={add}>
          <Icon name="plus" /> Add key
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((key, index) => (
          <article
            key={key.id}
            draggable
            onDragStart={(event) => {
              if (isInteractiveDragTarget(event.target)) {
                event.preventDefault();
                return;
              }
              setDragIndex(index);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className="workspace-panel"
            style={{
              margin: 0,
              padding: 14,
              borderStyle: dragIndex === index ? "dashed" : "solid",
              cursor: "grab",
            }}
          >
            <div className="form-grid" style={{ alignItems: "end" }}>
              <div>
                <label>Priority</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
                  <button type="button" className="icon-btn" title="Drag to reorder" aria-label="Drag to reorder">
                    <Icon name="moreVertical" />
                  </button>
                  <strong>#{index + 1}</strong>
                  <label className="toggle-row" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={key.enabled}
                      onChange={(event) => update(index, { enabled: event.target.checked })}
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>
              <div>
                <label>Label</label>
                <input value={key.label} onChange={(event) => update(index, { label: event.target.value })} />
              </div>
              <div>
                <label>Provider</label>
                <select
                  value={key.provider}
                  onChange={(event) => update(index, {
                    provider: event.target.value as AiKeyConfig["provider"],
                    model_options: [],
                    last_status: null,
                    info: null,
                  })}
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={!option.supported}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!providerInfo(key.provider).supported && (
                  <p className="hint" style={{ margin: "6px 0 0" }}>
                    Detected automatically. This provider is not supported for AI evaluation yet.
                  </p>
                )}
              </div>
              <div>
                <label>Model</label>
                {key.model_options?.length ? (
                  <select
                    value={key.model || key.model_options[0]?.value || model}
                    onChange={(event) => update(index, { model: event.target.value })}
                  >
                    {key.model_options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={key.model || model}
                    onChange={(event) => update(index, { model: event.target.value })}
                    placeholder={providerInfo(key.provider).supported ? "Detect & test key to list supported models" : "No supported evaluation models"}
                    disabled={!providerInfo(key.provider).supported}
                  />
                )}
                {providerInfo(key.provider).supported && !key.model_options?.length && (
                  <p className="hint" style={{ margin: "6px 0 0" }}>
                    Use Detect & test to load models available for this key.
                  </p>
                )}
              </div>
            </div>

            {key.provider === "custom_json" && (
              <div style={{ marginTop: 12 }}>
                <label>Endpoint URL</label>
                <input
                  type="url"
                  value={key.endpoint_url || endpointUrl}
                  onChange={(event) => update(index, { endpoint_url: event.target.value })}
                />
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label>API key</label>
              <PasswordInput
                value={key.api_key}
                onChange={(event) => {
                  const detectedProvider = detectProviderFromInput(event.target.value, key.endpoint_url || endpointUrl || "");
                  update(index, {
                    api_key: event.target.value,
                    provider: detectedProvider ?? key.provider,
                    model: detectedProvider && !modelMatchesProvider(detectedProvider, key.model)
                      ? defaultModelForProvider(detectedProvider, model)
                      : key.model,
                    model_options: [],
                    last_status: null,
                    info: detectedProvider && !providerInfo(detectedProvider).supported
                      ? `Detected ${providerInfo(detectedProvider).label.replace(" (detected, unsupported)", "")}. This evaluator currently supports Google Gemini, OpenAI, and Custom JSON evaluator endpoints.`
                      : null,
                  });
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                placeholder="Paste API key or keep saved masked key"
              />
              {isMaskedSecret(key.api_key) && (
                <p className="hint" style={{ margin: "6px 0 0" }}>
                  Saved key is active and masked after refresh. Detect & test uses the stored secret securely.
                </p>
              )}
            </div>

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <Badge tone={key.last_status === "ok" ? "green" : key.last_status === "failed" ? "red" : "gray"}>
                {key.last_status === "ok" ? "Connected" : key.last_status === "failed" ? "Failed" : "Not tested"}
              </Badge>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="secondary" onClick={() => void testKey(index)} disabled={testingId === key.id}>
                  {testingId === key.id ? "Detecting..." : "Detect & test"}
                </button>
                <button type="button" className="danger" onClick={() => remove(index)} disabled={rows.length === 1}>
                  <Icon name="trash" /> Remove
                </button>
              </div>
            </div>
            {key.info && <p className="hint" style={{ margin: "8px 0 0" }}>{key.info}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
