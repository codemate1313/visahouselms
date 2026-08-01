import { useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { PasswordInput } from "@/components/PasswordInput";

export interface AiKeyConfig {
  id: string;
  label: string;
  provider: "gemini" | "custom_json";
  model: string;
  endpoint_url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  last_status?: "ok" | "failed" | null;
  last_checked_at?: string | null;
  info?: string | null;
}

type AiProviderSelection = "gemini" | "custom_json" | "disabled";

interface TestResult {
  ok: boolean;
  provider: string;
  model: string;
  key_preview: string | null;
  latency_ms: number;
  message: string;
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
        provider: key.provider || provider,
        model: key.model || model,
        endpoint_url: key.endpoint_url || endpointUrl || undefined,
        api_key: key.api_key,
      });
      update(index, {
        last_status: data.ok ? "ok" : "failed",
        last_checked_at: new Date().toISOString(),
        info: `${data.message}${data.latency_ms ? ` (${data.latency_ms} ms)` : ""}`,
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
            onDragStart={() => setDragIndex(index)}
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
                  onChange={(event) => update(index, { provider: event.target.value as AiKeyConfig["provider"] })}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="custom_json">Custom JSON</option>
                </select>
              </div>
              <div>
                <label>Model</label>
                <input value={key.model || model} onChange={(event) => update(index, { model: event.target.value })} />
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
                onChange={(event) => update(index, { api_key: event.target.value, last_status: null, info: null })}
                placeholder="Paste API key or keep saved masked key"
              />
            </div>

            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <span className={`badge ${key.last_status === "ok" ? "badge-green" : key.last_status === "failed" ? "badge-red" : "badge-gray"}`}>
                {key.last_status === "ok" ? "Connected" : key.last_status === "failed" ? "Failed" : "Not tested"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="secondary" onClick={() => void testKey(index)} disabled={testingId === key.id}>
                  {testingId === key.id ? "Testing..." : "Test key"}
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
