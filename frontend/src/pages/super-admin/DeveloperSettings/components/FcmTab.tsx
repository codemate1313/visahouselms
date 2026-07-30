import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function FcmTab() {
  const [configured, setConfigured] = useState(false);
  const [webConfigured, setWebConfigured] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [saJson, setSaJson] = useState("");
  const [webApiKey, setWebApiKey] = useState("");
  const [webAppId, setWebAppId] = useState("");
  const [webMessagingSenderId, setWebMessagingSenderId] = useState("");
  const [webVapidKey, setWebVapidKey] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.fcm;

  const load = useCallback(() => {
    apiClient.get("/super-admin/dev-settings/fcm").then(({ data }) => {
      setConfigured(data.configured);
      setWebConfigured(data.web_configured);
      setProjectId(data.project_id ?? "");
      setWebApiKey(data.web_api_key ?? "");
      setWebAppId(data.web_app_id ?? "");
      setWebMessagingSenderId(data.web_messaging_sender_id ?? "");
      setWebVapidKey(data.web_vapid_key ?? "");
    });
  }, []);

  useEffect(load, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/fcm", {
        project_id: projectId || null,
        service_account_json: saJson || null,
        web_api_key: webApiKey || null,
        web_app_id: webAppId || null,
        web_messaging_sender_id: webMessagingSenderId || null,
        web_vapid_key: webVapidKey || null,
      });
      setNotice(t.savedNotice);
      setSaJson("");
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/dev-settings/fcm/test", {
        device_token: deviceToken || null,
      });
      setNotice(deviceToken ? t.testSentNotice : t.testValidNotice(data.project_id));
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.testError));
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
        badge={<span className={`badge ${configured ? "badge-green" : "badge-gray"}`}>{configured ? t.readyBadge : t.missingBadge}</span>}
      >
        <p className={configured ? "success-text" : "hint"}>{configured ? t.configuredHint : t.notConfiguredHint}</p>

        <label>{t.projectIdLabel}</label>
        <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder={t.projectIdPlaceholder} />

        <label>
          {t.saJsonLabel} {configured && t.saJsonReplaceHint}
        </label>
        <textarea rows={7} value={saJson} onChange={(e) => setSaJson(e.target.value)} placeholder={t.saJsonPlaceholder} />

        <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>{t.webConfigTitle}</h4>
        <p className={webConfigured ? "success-text" : "hint"}>
          {webConfigured ? t.webConfiguredHint : t.webNotConfiguredHint}
        </p>
        <p className="hint">{t.webConfigHint}</p>

        <label>{t.webApiKeyLabel}</label>
        <input value={webApiKey} onChange={(e) => setWebApiKey(e.target.value)} />

        <label>{t.webAppIdLabel}</label>
        <input value={webAppId} onChange={(e) => setWebAppId(e.target.value)} />

        <label>{t.webMessagingSenderIdLabel}</label>
        <input value={webMessagingSenderId} onChange={(e) => setWebMessagingSenderId(e.target.value)} />

        <label>{t.webVapidKeyLabel}</label>
        <input value={webVapidKey} onChange={(e) => setWebVapidKey(e.target.value)} />

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}

        <div className="form-actions">
          <button type="submit" disabled={busy}>{t.saveLabel}</button>
        </div>

        <div className="test-row">
          <input placeholder={t.deviceTokenPlaceholder} value={deviceToken} onChange={(e) => setDeviceToken(e.target.value)} />
          <button type="button" disabled={busy || !configured} onClick={test}>
            {deviceToken ? t.sendTestLabel : t.validateLabel}
          </button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
