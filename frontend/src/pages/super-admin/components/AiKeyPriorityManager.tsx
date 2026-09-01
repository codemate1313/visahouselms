import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";

export interface AiKeyConfig {
  id: string;
  label: string;
  provider: AiDetectedProvider;
  /** Legacy single model, kept so keys saved before the split still load. */
  model: string;
  /** Writing and Speaking are marked by different models: only some can hear
   *  a recording, and a paper of essays should not pay for one that can. */
  writing_model?: string;
  speaking_model?: string;
  endpoint_url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  last_status?: "ok" | "failed" | null;
  last_checked_at?: string | null;
  info?: string | null;
  model_options?: ModelOption[];
  writing_models?: ModelOption[];
  speaking_models?: ModelOption[];
}

type AiProviderSelection = "gemini" | "openai" | "custom_json" | "disabled";
type AiDetectedProvider = "gemini" | "custom_json" | "openai" | "anthropic" | "unknown";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

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
  available?: boolean;
  /** Which papers this model can mark - "writing", "speaking", or both. */
  skills?: string[];
}

/** Which papers a model can mark, when the server has not said yet. */
function modelSkills(option: ModelOption): string[] {
  return option.skills?.length ? option.skills : ["writing", "speaking"];
}

function optionsForSkill(options: ModelOption[], skill: string): ModelOption[] {
  return options.filter((option) => modelSkills(option).includes(skill));
}

interface TestResult {
  ok: boolean;
  provider: string;
  provider_label?: string;
  detected_provider?: string;
  model: string;
  model_options?: ModelOption[];
  writing_models?: ModelOption[];
  speaking_models?: ModelOption[];
  writing_model?: string;
  speaking_model?: string;
  key_preview: string | null;
  latency_ms: number;
  supported?: boolean;
  message: string;
  detection_message?: string;
}

interface ModelListResult {
  ok: boolean;
  provider: string;
  provider_label?: string;
  detected_provider?: string;
  model: string;
  model_options?: ModelOption[];
  writing_models?: ModelOption[];
  speaking_models?: ModelOption[];
  writing_model?: string;
  speaking_model?: string;
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
  /** Asks the provider which models this key can use, without grading anything. */
  modelsPath: string;
}

function newKey(index: number, provider: AiProviderSelection, model: string, endpointUrl: string): AiKeyConfig {
  return {
    id: `key-${Date.now()}-${index}`,
    label: `API Key ${index + 1}`,
    provider: provider === "disabled" ? "gemini" : provider,
    model,
    writing_model: "",
    speaking_model: "",
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
  if (provider === "openai") return DEFAULT_OPENAI_MODEL;
  if (provider === "gemini") return DEFAULT_GEMINI_MODEL;
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

function selectableModelValue(preferred?: string, options?: ModelOption[]) {
  if (preferred && options?.some((option) => option.value === preferred && option.available !== false)) {
    return preferred;
  }
  return options?.find((option) => option.available !== false)?.value;
}

interface ModelPickerProps {
  keyConfig: AiKeyConfig;
  fallbackModel: string;
  onPick: (value: string) => void;
}

/**
 * The one model this key marks with.
 *
 * One model rather than one per skill, because that is what lets a Final Test
 * or full mock send its Writing and its Speaking in a single request - and
 * every provider limit that matters counts requests, not parts.
 *
 * Options are whatever the provider says this key can run, best first, with
 * the ones that cannot hear a recording marked as such: choosing one of those
 * means Speaking goes to an instructor. Nothing is hardcoded - until the key
 * has been checked there is no list, which is the honest state to show.
 */
function ModelPicker({ keyConfig, fallbackModel, onPick }: ModelPickerProps) {
  const supported = providerInfo(keyConfig.provider).supported;
  const options = keyConfig.model_options ?? [];
  const selected = keyConfig.model || keyConfig.writing_model || fallbackModel;

  if (!supported) {
    return <input value="" disabled placeholder="No supported evaluation models" />;
  }

  if (!options.length) {
    return (
      <>
        <input value={selected} disabled placeholder="Load models to list what this key supports" />
        <p className="hint" style={{ margin: "6px 0 0" }}>Paste the key, then use Load models.</p>
      </>
    );
  }

  const speakingCapable = new Set(optionsForSkill(options, "speaking").map((option) => option.value));
  return (
    <>
      <select value={selected} onChange={(event) => onPick(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.available === false}>
            {option.label}
            {speakingCapable.has(option.value) ? "" : " - Writing only"}
          </option>
        ))}
      </select>
      {selected && !speakingCapable.has(selected) && (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          This model cannot mark Speaking recordings - they will go to an instructor.
        </p>
      )}
    </>
  );
}

export function AiKeyPriorityManager({
  keys,
  onChange,
  provider,
  model,
  endpointUrl,
  testPath,
  modelsPath,
}: AiKeyPriorityManagerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [loadingModelsId, setLoadingModelsId] = useState<string | null>(null);
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

  /**
   * `silent` is the refresh that runs when the screen opens: it brings the
   * lists up to date with what the provider offers *now* without shouting
   * about it, because a saved model list goes stale the moment the provider
   * retires something and a dropdown of models that no longer exist is how a
   * dead one gets picked.
   */
  async function loadModels(index: number, { silent = false }: { silent?: boolean } = {}) {
    const key = rows[index];
    if (!silent) setLoadingModelsId(key.id);
    if (!silent) setError(null);
    try {
      const { data } = await apiClient.post<ModelListResult>(modelsPath, {
        key_id: key.id,
        provider: "auto",
        preferred_provider: key.provider || provider,
        model: key.model || model,
        // What is selected on screen right now, saved or not - otherwise the
        // server answers about the stored key and overwrites the choice.
        writing_model: key.model || undefined,
        speaking_model: key.model || undefined,
        endpoint_url: key.endpoint_url || endpointUrl || undefined,
        api_key: key.api_key,
      });
      const detectedProvider = data.detected_provider || data.provider;
      const providerPatch = providerOptions.some((option) => option.value === detectedProvider)
        ? { provider: detectedProvider as AiKeyConfig["provider"] }
        : {};
      update(index, {
        ...providerPatch,
        // Prefer what the key actually offers over whatever model was typed:
        // a retired model is exactly what this button exists to replace.
        model: selectableModelValue(data.model, data.model_options) || key.model || model,
        model_options: data.model_options || [],
        writing_models: data.writing_models || [],
        speaking_models: data.speaking_models || [],
        // The server picks a working model per skill, so a key that can mark
        // is never left needing a decision before it will.
        writing_model: selectableModelValue(key.model, data.model_options) || data.writing_model || "",
        speaking_model: selectableModelValue(key.model, data.model_options) || data.speaking_model || "",
        // A background refresh leaves the last real result on screen.
        ...(silent ? {} : { info: `${data.provider_label ? `${data.provider_label}: ` : ""}${data.message}` }),
      });
      if (!data.ok && !silent) setError(data.message);
    } catch (err: unknown) {
      if (silent) return;
      const message = extractErrorMessage(err, "Could not load models for this key.");
      update(index, { info: message });
      setError(message);
    } finally {
      if (!silent) setLoadingModelsId(null);
    }
  }

  /* One refresh per key per visit. Without it the dropdowns show whatever the
     provider offered the last time someone pressed a button, which may be
     months and one model retirement ago. */
  const refreshedRef = useRef<Set<string>>(new Set());
  const refreshLists = useCallback(() => {
    rows.forEach((key, index) => {
      // A row with no key yet has nothing to ask with.
      if (!key.api_key || refreshedRef.current.has(key.id)) return;
      refreshedRef.current.add(key.id);
      void loadModels(index, { silent: true });
    });
    // `loadModels` is redeclared each render; the ref above is what stops this
    // from running twice for the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(refreshLists, [refreshLists]);

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
        writing_model: key.model || undefined,
        speaking_model: key.model || undefined,
        endpoint_url: key.endpoint_url || endpointUrl || undefined,
        api_key: key.api_key,
      });
      const detectedProvider = data.detected_provider || data.provider;
      const providerPatch = providerOptions.some((option) => option.value === detectedProvider)
        ? { provider: detectedProvider as AiKeyConfig["provider"] }
        : {};
      update(index, {
        ...providerPatch,
        model: selectableModelValue(data.model, data.model_options) || key.model || model,
        model_options: data.model_options || [],
        writing_models: data.writing_models || [],
        speaking_models: data.speaking_models || [],
        // The admin's own choice survives a check, as long as the provider
        // still offers it - a test must not quietly re-pick their model.
        writing_model: selectableModelValue(key.model, data.model_options) || data.writing_model || "",
        speaking_model: selectableModelValue(key.model, data.model_options) || data.speaking_model || "",
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
        <Button type="button" variant="secondary" className="secondary" onClick={add}>
          <Icon name="plus" /> Add key
        </Button>
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
                    last_checked_at: null,
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
                <ModelPicker
                  keyConfig={key}
                  fallbackModel={model}
                  onPick={(value) => update(index, {
                    // One model marks both skills, which is what lets a Final
                    // Test send its Writing and Speaking in a single request.
                    model: value,
                    writing_model: value,
                    speaking_model: value,
                    last_status: null,
                    last_checked_at: null,
                    info: null,
                  })}
                />
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
                    last_checked_at: null,
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
                <Button
                  type="button"
                  variant="secondary"
                  className="secondary"
                  onClick={() => void loadModels(index)}
                  disabled={loadingModelsId === key.id || testingId === key.id}
                >
                  {loadingModelsId === key.id ? "Loading models..." : "Load models"}
                </Button>
                <Button type="button" variant="secondary" className="secondary" onClick={() => void testKey(index)} disabled={testingId === key.id}>
                  {testingId === key.id ? "Detecting..." : "Detect & test"}
                </Button>
                <Button type="button" variant="danger" className="danger" onClick={() => remove(index)} disabled={rows.length === 1}>
                  <Icon name="trash" /> Remove
                </Button>
              </div>
            </div>
            {key.info && <p className="hint" style={{ margin: "8px 0 0" }}>{key.info}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
