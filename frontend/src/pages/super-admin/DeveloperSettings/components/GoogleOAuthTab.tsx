import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

interface GoogleOAuthForm {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export function GoogleOAuthTab() {
  // Note on client_secret: the server always returns the fixed placeholder
  // "********" for a configured secret (never the real value) and treats an
  // incoming "********" as "leave unchanged" - see backend
  // `settings_service.SECRET_PLACEHOLDER` / `set_settings_group`. Because
  // that placeholder round-trips identically between load and submit
  // whenever the user doesn't touch the field, a plain whole-form diff
  // already reports "no changes" correctly with no special-casing needed.
  const [form, setForm] = useState<GoogleOAuthForm>({
    client_id: "",
    client_secret: "",
    redirect_uri: "",
  });
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<GoogleOAuthForm | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = strings.googleOAuth;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const suggestedCallbackUrl = `${origin}/api/auth/google/callback`;

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data } = await apiClient.get<Record<string, string | null>>("/super-admin/dev-settings/google-oauth");
      const nextForm: GoogleOAuthForm = {
        client_id: data.client_id ?? "",
        client_secret: data.client_secret ?? "",
        redirect_uri: data.redirect_uri ?? "",
      };
      setForm(nextForm);
      originalRef.current = nextForm;
    } catch {
      // Keep default empty form
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (originalRef.current && isEqual(originalRef.current, form)) {
      showInfo(noChangesMessage);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { data } = await apiClient.put<Record<string, string | null>>("/super-admin/dev-settings/google-oauth", form);
      const nextForm: GoogleOAuthForm = {
        client_id: data.client_id ?? "",
        client_secret: data.client_secret ?? "",
        redirect_uri: data.redirect_uri ?? "",
      };
      setForm(nextForm);
      originalRef.current = nextForm;
      setNotice(t.saveSuccess);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(suggestedCallbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function useSuggestedRedirectUri() {
    setForm({ ...form, redirect_uri: suggestedCallbackUrl });
  }

  const isConfigured = Boolean(form.client_id && form.client_secret);

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={t.title}
        description={t.description}
        badge={
          <Badge tone={isConfigured ? "green" : "gray"}>
            {isConfigured ? t.configuredBadge : t.notConfiguredBadge}
          </Badge>
        }
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.clientIdLabel}</label>
              <input
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder={t.clientIdPlaceholder}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <label style={{ fontWeight: 700, fontSize: "0.8125rem", margin: 0 }}>{t.clientSecretLabel}</label>
                {form.client_secret?.includes("*") && (
                  <span className="ui-secret-status">Encrypted & Active</span>
                )}
              </div>
              <PasswordInput
                value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                placeholder={t.clientSecretPlaceholder}
              />
              {form.client_secret?.includes("*") && (
                <small className="ui-secret-hint">Client secret is encrypted & active. Masked as <code>********</code> for security.</small>
              )}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.redirectUriLabel}</label>
            <input
              value={form.redirect_uri}
              onChange={(e) => setForm({ ...form, redirect_uri: e.target.value })}
              placeholder={t.redirectUriPlaceholder}
            />
            <small style={{ color: "var(--text-muted)" }}>{t.redirectUriHint}</small>
          </div>

          <div
            style={{
              marginTop: "1rem",
              background: "var(--surface-subtle, #f8fafc)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "0.65rem 0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.775rem",
              color: "var(--text-secondary, #475569)",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span>
              <strong>{t.callbackUrlBoxLabel}</strong> <code className="ui-code-info">{suggestedCallbackUrl}</code>
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={useSuggestedRedirectUri}
                style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", background: "var(--surface-muted)", border: "1px solid var(--border)" }}
              >
                {t.useSuggestedLabel}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopy}
                style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
              >
                {copied ? t.copiedLabel : t.copyLabel}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}

        <div className="form-actions" style={{ marginTop: "1.25rem" }}>
          <button type="submit" disabled={busy} className="btn-primary">
            <Icon name="check" style={{ fontSize: "16px" }} />
            {busy ? "Saving Settings..." : t.saveBtn}
          </button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
