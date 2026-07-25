import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function SmtpTab() {
  const [form, setForm] = useState({
    host: "", port: "", username: "", password: "", encryption: "tls", from_address: "",
  });
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.smtp;

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/smtp").then(({ data }) => {
      setForm((prev) => ({
        ...prev,
        host: data.host ?? "",
        port: data.port ?? "",
        username: data.username ?? "",
        password: data.password ?? "",
        encryption: data.encryption ?? "tls",
        from_address: data.from_address ?? "",
      }));
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/smtp", form);
      setNotice(t.savedNotice);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.post("/super-admin/dev-settings/smtp/test", { to_address: testTo });
      setNotice(t.testSentNotice(testTo));
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.testError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel className="form-card-collapsible" title={t.title} description={t.description}>
        <div className="form-grid">
          <div>
            <label>{t.hostLabel}</label>
            <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder={t.hostPlaceholder} />
          </div>
          <div>
            <label>{t.portLabel}</label>
            <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder={t.portPlaceholder} />
          </div>
          <div>
            <label>{t.usernameLabel}</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label>{t.passwordLabel}</label>
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t.passwordPlaceholder} />
          </div>
          <div>
            <label>{t.encryptionLabel}</label>
            <SearchableSelect
              options={t.encryptionOptions}
              value={form.encryption}
              onChange={(value) => setForm({ ...form, encryption: String(value) })}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label>{t.fromAddressLabel}</label>
            <input value={form.from_address} onChange={(e) => setForm({ ...form, from_address: e.target.value })} placeholder={t.fromAddressPlaceholder} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}

        <div className="form-actions">
          <button type="submit" disabled={busy}>{t.saveLabel}</button>
        </div>

        <div className="test-row">
          <input placeholder={t.testToPlaceholder} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button type="button" disabled={busy || !testTo} onClick={sendTest}>{t.sendTestLabel}</button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
