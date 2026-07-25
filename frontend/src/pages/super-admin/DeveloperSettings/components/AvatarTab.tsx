import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function AvatarTab() {
  const [form, setForm] = useState({ provider: "d_id", api_key: "", presenter_image_url: "", voice_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.avatar;

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/avatar").then(({ data }) => {
      setForm((prev) => ({
        ...prev,
        provider: data.provider ?? "d_id",
        api_key: data.api_key ?? "",
        presenter_image_url: data.presenter_image_url ?? "",
        voice_id: data.voice_id ?? "",
      }));
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/avatar", form);
      setNotice(t.savedNotice);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/dev-settings/avatar/test");
      setNotice(data.connected ? t.testConnectedNotice : t.testUnverifiedNotice);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.testError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel className="form-card-collapsible" title={t.title} description={t.description}>
        <p className="hint">{t.hint}</p>
        <div className="form-grid">
          <div>
            <label>{t.providerLabel}</label>
            <SearchableSelect
              options={[{ value: "d_id", label: "D-ID" }]}
              value={form.provider}
              onChange={(value) => setForm({ ...form, provider: String(value) })}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label>{t.voiceLabel}</label>
            <input value={form.voice_id} onChange={(e) => setForm({ ...form, voice_id: e.target.value })} placeholder={t.voicePlaceholder} />
          </div>
        </div>
        <label>{t.apiKeyLabel}</label>
        <PasswordInput value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder={t.apiKeyPlaceholder} />
        <label>{t.presenterImageLabel}</label>
        <input
          value={form.presenter_image_url}
          onChange={(e) => setForm({ ...form, presenter_image_url: e.target.value })}
          placeholder={t.presenterImagePlaceholder}
        />

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}

        <div className="form-actions">
          <button type="submit" disabled={busy}>{t.saveLabel}</button>
        </div>
        <div className="test-row">
          <button type="button" disabled={busy || !form.api_key} onClick={test}>{t.testLabel}</button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
