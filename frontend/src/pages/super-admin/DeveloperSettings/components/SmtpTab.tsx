import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

interface SmtpForm {
  host: string;
  port: string;
  username: string;
  password: string;
  encryption: string;
  from_address: string;
}

export function SmtpTab() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showInfo = useToastStore((state) => state.showInfo);
  // Note on `password`: the server always returns the fixed placeholder
  // "********" for a configured password (never the real value) and treats
  // an incoming "********" as "leave unchanged" (see backend
  // settings_service.SECRET_PLACEHOLDER / set_settings_group). That
  // placeholder round-trips identically between load and submit whenever the
  // user doesn't touch the field, so comparing the whole form as-is already
  // reports "no changes" correctly with no field exclusion needed; typing a
  // real new password differs from the placeholder and is still detected.
  const [form, setForm] = useState<SmtpForm>({
    host: "", port: "", username: "", password: "", encryption: "tls", from_address: "",
  });
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const originalRef = useRef<SmtpForm | null>(null);
  const t = strings.smtp;

  useEffect(() => {
    apiClient.get("/super-admin/dev-settings/smtp").then(({ data }) => {
      setForm((prev) => {
        const next: SmtpForm = {
          ...prev,
          host: data.host ?? "",
          port: data.port ?? "",
          username: data.username ?? "",
          password: data.password ?? "",
          encryption: data.encryption ?? "tls",
          from_address: data.from_address ?? "",
        };
        originalRef.current = next;
        return next;
      });
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (originalRef.current && isEqual(originalRef.current, form)) {
      showInfo(noChangesMessage);
      return;
    }
    setError(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/smtp", form);
      originalRef.current = form;
      showSuccess(t.savedNotice);
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, t.saveError);
      setError(errMsg);
      showError(errMsg);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setError(null); setBusy(true);
    try {
      await apiClient.post("/super-admin/dev-settings/smtp/test", { to_address: testTo });
      showSuccess(t.testSentNotice(testTo));
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, t.testError);
      setError(errMsg);
      showError(errMsg);
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
