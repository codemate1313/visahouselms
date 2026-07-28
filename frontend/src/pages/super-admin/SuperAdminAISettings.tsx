import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { PasswordInput } from "@/components/PasswordInput";
import { RequiredMark } from "@/components/ui";
import { Icon } from "@/components/icons";
import { superAdminAiSettingsStrings as strings } from "./SuperAdminAISettings.strings";

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
        setError(extractErrorMessage(err, strings.errors.load));
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
        setError(extractErrorMessage(err, strings.errors.save));
      });
  };

  if (loading) {
    return <p className="hint">{strings.loading}</p>;
  }

  const isMaskedKey = Boolean(rawApiKey && rawApiKey.includes("*"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>{strings.title}</h1>
          <p className="hint">
            {strings.subtitle}
          </p>
        </div>
        <span className={`badge ${formData.configured ? "badge-green" : "badge-gray"}`}>
          {formData.configured ? strings.configuredBadge : strings.setupRequiredBadge}
        </span>
      </div>

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      <form className="form-card wide" onSubmit={handleSubmit}>
        
        {/* Provider Selector */}
        <div>
          <label className="font-bold">
            {strings.providerLegend} <RequiredMark />
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
                <label htmlFor="provider-gemini">{strings.providers.gemini.label}</label>
              </div>
              <p className="ai-provider-card-desc">
                {strings.providers.gemini.description}
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
                <label htmlFor="provider-custom">{strings.providers.customJson.label}</label>
              </div>
              <p className="ai-provider-card-desc">
                {strings.providers.customJson.description}
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
                <label htmlFor="provider-disabled">{strings.providers.disabled.label}</label>
              </div>
              <p className="ai-provider-card-desc">
                {strings.providers.disabled.description}
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
                    {strings.geminiKeyLabel} <RequiredMark />
                  </label>
                  {isMaskedKey && (
                    <span className="badge badge-green">
                      <Icon name="check" /> {strings.apiKeyActiveBadge}
                    </span>
                  )}
                </div>
                <PasswordInput
                  id="gemini-key-input"
                  required
                  placeholder={strings.geminiKeyPlaceholder}
                  value={rawApiKey}
                  onChange={(e) => setRawApiKey(e.target.value)}
                />
                {isMaskedKey ? (
                  <p className="hint text-xs" style={{ marginTop: 6 }}>
                    <Icon name="lock" /> <strong>{strings.securityNoteLabel}</strong> {strings.securityNoteBody}
                  </p>
                ) : (
                  <p className="hint text-xs" style={{ marginTop: 6 }}>
                    {strings.geminiKeyHelpPrefix}{" "}
                    <a
                      href={strings.geminiKeyHelpUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb" }}
                    >
                      {strings.geminiKeyHelpLinkLabel}
                    </a>{strings.geminiKeyHelpSuffix}
                  </p>
                )}
              </div>
            )}

            {/* Custom Endpoint URL */}
            {formData.provider === "custom_json" && (
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="custom-url-input">
                  {strings.endpointLabel} <RequiredMark />
                </label>
                <input
                  id="custom-url-input"
                  type="url"
                  required
                  placeholder={strings.endpointPlaceholder}
                  value={formData.endpoint_url || ""}
                  onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                />
              </div>
            )}

            {/* Fields Grid */}
            <div className="form-grid">
              <div>
                <label htmlFor="ai-model-input">{strings.modelLabel}</label>
                <input
                  id="ai-model-input"
                  type="text"
                  value={formData.model || strings.defaultModel}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="monthly-quota-input">{strings.monthlyQuotaLabel}</label>
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
            {saving ? strings.saving : strings.save}
          </button>
        </div>
      </form>
    </div>
  );
}
