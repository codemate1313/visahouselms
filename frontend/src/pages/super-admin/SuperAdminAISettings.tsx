import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { PasswordInput } from "@/components/PasswordInput";
import { RequiredMark } from "@/components/ui";

interface AiSettingsData {
  enabled: boolean;
  provider: "gemini" | "custom_json" | "disabled";
  endpoint_url: string | null;
  model: string | null;
  monthly_limit: number;
  configured: boolean;
  api_key: string | null;
}

export function SuperAdminAISettings() {
  const [formData, setFormData] = useState<AiSettingsData>({
    enabled: true,
    provider: "gemini",
    endpoint_url: "",
    model: "gemini-2.0-flash",
    monthly_limit: 1500,
    configured: true,
    api_key: "",
  });

  const [rawApiKey, setRawApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadSettings() {
    setLoading(true);
    apiClient
      .get<AiSettingsData>("/super-admin/settings/ai")
      .then(({ data }) => {
        setFormData({
          ...data,
          endpoint_url: data.endpoint_url || "",
          model: data.model || "gemini-2.0-flash",
          monthly_limit: data.monthly_limit || 1500,
        });
        setRawApiKey(data.api_key || "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(extractErrorMessage(err, "Failed to load AI evaluation settings"));
        setLoading(false);
      });
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    const payload = {
      enabled: formData.provider !== "disabled",
      provider: formData.provider,
      model: formData.model || "gemini-2.0-flash",
      api_key: rawApiKey.trim() ? rawApiKey.trim() : undefined,
      endpoint_url: formData.endpoint_url || undefined,
      monthly_limit: Number(formData.monthly_limit || 1500),
    };

    apiClient
      .put<AiSettingsData>("/super-admin/settings/ai", payload)
      .then(({ data }) => {
        setFormData({
          ...data,
          endpoint_url: data.endpoint_url || "",
          model: data.model || "gemini-2.0-flash",
          monthly_limit: data.monthly_limit || 1500,
        });
        setRawApiKey(data.api_key || "");
        setSaving(false);
        setNotice("AI settings updated successfully! Changes take effect immediately.");
      })
      .catch((err: unknown) => {
        setSaving(false);
        setError(extractErrorMessage(err, "Failed to update AI evaluation settings"));
      });
  };

  if (loading) {
    return <p className="hint">Loading AI evaluation settings...</p>;
  }

  const isMaskedKey = Boolean(rawApiKey && rawApiKey.includes("*"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>AI Evaluation & Scoring Settings</h1>
          <p className="hint">
            Configure AI scoring engines for automatic Writing and Speaking test evaluations.
          </p>
        </div>
        <span className={`badge ${formData.configured ? "badge-green" : "badge-gray"}`}>
          {formData.configured ? "Engine Configured & Ready" : "Setup Required"}
        </span>
      </div>

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      <form className="form-card wide" onSubmit={handleSubmit}>
        
        {/* Provider Selector */}
        <div>
          <label className="font-bold">
            AI Evaluation Provider Mode <RequiredMark />
          </label>
          <div className="ai-provider-grid">
            
            {/* Google Gemini Card */}
            <div
              className={`ai-provider-card ${formData.provider === "gemini" ? "active" : ""}`}
              onClick={() => setFormData({ ...formData, provider: "gemini", enabled: true })}
            >
              <div className="ai-provider-card-header">
                <input
                  type="radio"
                  id="provider-gemini"
                  name="provider"
                  checked={formData.provider === "gemini"}
                  onChange={() => setFormData({ ...formData, provider: "gemini", enabled: true })}
                />
                <label htmlFor="provider-gemini">Google Gemini 1.5 / 2.0 Flash</label>
              </div>
              <p className="ai-provider-card-desc">
                Direct multimodality: evaluates Writing (text) and Speaking (raw audio) natively. Free-tier supported.
              </p>
            </div>

            {/* Our System AI Evaluator (Custom JSON Endpoint) */}
            <div
              className={`ai-provider-card ${formData.provider === "custom_json" ? "active" : ""}`}
              onClick={() => setFormData({ ...formData, provider: "custom_json", enabled: true })}
            >
              <div className="ai-provider-card-header">
                <input
                  type="radio"
                  id="provider-custom"
                  name="provider"
                  checked={formData.provider === "custom_json"}
                  onChange={() => setFormData({ ...formData, provider: "custom_json", enabled: true })}
                />
                <label htmlFor="provider-custom">Our System AI Evaluator (Custom JSON Endpoint)</label>
              </div>
              <p className="ai-provider-card-desc">
                Connects to our internal custom HTTP JSON evaluator microservice or self-hosted LLM server (Ollama, vLLM).
              </p>
            </div>

            {/* Disabled Card */}
            <div
              className={`ai-provider-card ${formData.provider === "disabled" ? "active" : ""}`}
              onClick={() => setFormData({ ...formData, provider: "disabled", enabled: false })}
            >
              <div className="ai-provider-card-header">
                <input
                  type="radio"
                  id="provider-disabled"
                  name="provider"
                  checked={formData.provider === "disabled"}
                  onChange={() => setFormData({ ...formData, provider: "disabled", enabled: false })}
                />
                <label htmlFor="provider-disabled">Disabled</label>
              </div>
              <p className="ai-provider-card-desc">
                Disable AI scoring suggestions. All evaluations remain 100% human examiner rated.
              </p>
            </div>

          </div>
        </div>

        {/* Dynamic Fields */}
        {formData.provider !== "disabled" && (
          <div style={{ paddingTop: 16, borderTop: "1px solid rgba(226, 232, 240, 0.4)" }}>
            
            {/* Gemini Key */}
            {formData.provider === "gemini" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label htmlFor="gemini-key-input" style={{ margin: 0 }}>
                    Google Gemini API Key <RequiredMark />
                  </label>
                  {isMaskedKey && (
                    <span className="badge badge-green">
                      ✓ API Key Saved & Active (Encrypted)
                    </span>
                  )}
                </div>
                <PasswordInput
                  id="gemini-key-input"
                  required
                  placeholder="Enter API key (e.g. AQ.Ab8RN6...)"
                  value={rawApiKey}
                  onChange={(e) => setRawApiKey(e.target.value)}
                />
                {isMaskedKey ? (
                  <p className="hint text-xs" style={{ marginTop: 6 }}>
                    🔒 <strong>Security Note:</strong> Your API key is active and encrypted at rest in the database. For security compliance, saved secrets are masked as <code>********</code> when loaded. To replace it, type a new API key.
                  </p>
                ) : (
                  <p className="hint text-xs" style={{ marginTop: 6 }}>
                    Get a free API key from{" "}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb" }}
                    >
                      Google AI Studio
                    </a>. Key is encrypted at rest.
                  </p>
                )}
              </div>
            )}

            {/* Custom Endpoint URL */}
            {formData.provider === "custom_json" && (
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="custom-url-input">
                  Custom Evaluator Endpoint URL <RequiredMark />
                </label>
                <input
                  id="custom-url-input"
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/v1/evaluate"
                  value={formData.endpoint_url || ""}
                  onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                />
              </div>
            )}

            {/* Fields Grid */}
            <div className="form-grid">
              <div>
                <label htmlFor="ai-model-input">Model Name</label>
                <input
                  id="ai-model-input"
                  type="text"
                  value={formData.model || "gemini-2.0-flash"}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="monthly-quota-input">Monthly Evaluation Quota Limit</label>
                <input
                  id="monthly-quota-input"
                  type="number"
                  min="1"
                  max="100000"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData({ ...formData, monthly_limit: Number(e.target.value) })}
                />
              </div>
            </div>

          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving AI Settings..." : "Save AI Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
