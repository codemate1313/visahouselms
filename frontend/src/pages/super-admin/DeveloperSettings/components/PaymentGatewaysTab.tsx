import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PasswordInput } from "@/components/PasswordInput";
import { Checkbox } from "@/components/ui";
import { Icon } from "@/components/icons";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function PaymentGatewaysTab() {
  const [form, setForm] = useState({
    razorpay_enabled: false,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    razorpay_webhook_secret: "",
    stripe_enabled: false,
    stripe_publishable_key: "",
    stripe_secret_key: "",
    stripe_webhook_secret: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const t = strings.paymentGateways;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const razorpayWebhookUrl = `${origin}/api/v1/payments/webhook/razorpay`;
  const stripeWebhookUrl = `${origin}/api/v1/payments/webhook/stripe`;

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data } = await apiClient.get<Record<string, string | null>>("/super-admin/dev-settings/payment-gateways");
      setForm({
        razorpay_enabled: data.razorpay_enabled === "true",
        razorpay_key_id: data.razorpay_key_id ?? "",
        razorpay_key_secret: data.razorpay_key_secret ?? "",
        razorpay_webhook_secret: data.razorpay_webhook_secret ?? "",
        stripe_enabled: data.stripe_enabled === "true",
        stripe_publishable_key: data.stripe_publishable_key ?? "",
        stripe_secret_key: data.stripe_secret_key ?? "",
        stripe_webhook_secret: data.stripe_webhook_secret ?? "",
      });
    } catch {
      // Keep default empty form
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/payment-gateways", form);
      setNotice(t.saveSuccess);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const isRazorpayConfigured = Boolean(form.razorpay_enabled && form.razorpay_key_id);
  const isStripeConfigured = Boolean(form.stripe_enabled && form.stripe_publishable_key);
  const isAnyConfigured = isRazorpayConfigured || isStripeConfigured;

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={save}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={t.title}
        description={t.description}
        badge={
          <span className={`badge ${isAnyConfigured ? "badge-green" : "badge-gray"}`}>
            {isAnyConfigured ? "Active Gateways" : "Not Configured"}
          </span>
        }
      >
        {/* Razorpay Section Card */}
        <div
          style={{
            background: "var(--surface-bg, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#e0f2fe",
                  color: "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Icon name="wallet" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                  {t.razorpayTitle}
                </h3>
                <small style={{ color: "var(--text-muted, #64748b)" }}>{t.razorpayDesc}</small>
              </div>
            </div>

            <label className="toggle-row" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>
              <Checkbox
                checked={form.razorpay_enabled}
                onChange={(e) => setForm({ ...form, razorpay_enabled: e.target.checked })}
              />
              <span>{t.razorpayEnable}</span>
            </label>
          </div>

          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.razorpayKeyIdLabel}</label>
              <input
                value={form.razorpay_key_id}
                onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
                placeholder={t.razorpayKeyIdPlaceholder}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <label style={{ fontWeight: 700, fontSize: "0.8125rem", margin: 0 }}>{t.razorpayKeySecretLabel}</label>
                {form.razorpay_key_secret?.includes("*") && (
                  <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>✓ Encrypted & Active</span>
                )}
              </div>
              <PasswordInput
                value={form.razorpay_key_secret}
                onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
                placeholder={t.razorpayKeySecretPlaceholder}
              />
              {form.razorpay_key_secret?.includes("*") && (
                <small style={{ display: "block", marginTop: "0.2rem", fontSize: "0.725rem", color: "#64748b" }}>
                  🔒 Secret key is encrypted & active. Masked as <code>********</code> for security.
                </small>
              )}
            </div>
          </div>


          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem", margin: 0 }}>{t.razorpayWebhookSecretLabel}</label>
              {form.razorpay_webhook_secret?.includes("*") && (
                <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>✓ Encrypted & Active</span>
              )}
            </div>
            <PasswordInput
              value={form.razorpay_webhook_secret}
              onChange={(e) => setForm({ ...form, razorpay_webhook_secret: e.target.value })}
              placeholder={t.razorpayWebhookSecretPlaceholder}
            />
          </div>

          <div
            style={{
              marginTop: "1rem",
              background: "var(--surface-subtle, #f8fafc)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "10px",
              padding: "0.65rem 0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.775rem",
              color: "var(--text-secondary, #475569)",
            }}
          >
            <span>
              <strong>Webhook Callback URL:</strong> <code style={{ color: "#0284c7" }}>{razorpayWebhookUrl}</code>
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleCopy(razorpayWebhookUrl, "razorpay")}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
            >
              {copiedKey === "razorpay" ? "Copied!" : "Copy URL"}
            </button>
          </div>
        </div>

        {/* Stripe Section Card */}
        <div
          style={{
            background: "var(--surface-bg, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#f3e8ff",
                  color: "#9333ea",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Icon name="transactions" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                  {t.stripeTitle}
                </h3>
                <small style={{ color: "var(--text-muted, #64748b)" }}>{t.stripeDesc}</small>
              </div>
            </div>

            <label className="toggle-row" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>
              <Checkbox
                checked={form.stripe_enabled}
                onChange={(e) => setForm({ ...form, stripe_enabled: e.target.checked })}
              />
              <span>{t.stripeEnable}</span>
            </label>
          </div>

          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.stripePublishableKeyLabel}</label>
              <input
                value={form.stripe_publishable_key}
                onChange={(e) => setForm({ ...form, stripe_publishable_key: e.target.value })}
                placeholder={t.stripePublishableKeyPlaceholder}
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <label style={{ fontWeight: 700, fontSize: "0.8125rem", margin: 0 }}>{t.stripeSecretKeyLabel}</label>
                {form.stripe_secret_key?.includes("*") && (
                  <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>✓ Encrypted & Active</span>
                )}
              </div>
              <PasswordInput
                value={form.stripe_secret_key}
                onChange={(e) => setForm({ ...form, stripe_secret_key: e.target.value })}
                placeholder={t.stripeSecretKeyPlaceholder}
              />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem", margin: 0 }}>{t.stripeWebhookSecretLabel}</label>
              {form.stripe_webhook_secret?.includes("*") && (
                <span style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>✓ Encrypted & Active</span>
              )}
            </div>
            <PasswordInput
              value={form.stripe_webhook_secret}
              onChange={(e) => setForm({ ...form, stripe_webhook_secret: e.target.value })}
              placeholder={t.stripeWebhookSecretPlaceholder}
            />
          </div>

          <div
            style={{
              marginTop: "1rem",
              background: "var(--surface-subtle, #f8fafc)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "10px",
              padding: "0.65rem 0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.775rem",
              color: "var(--text-secondary, #475569)",
            }}
          >
            <span>
              <strong>Webhook Callback URL:</strong> <code style={{ color: "#9333ea" }}>{stripeWebhookUrl}</code>
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleCopy(stripeWebhookUrl, "stripe")}
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
            >
              {copiedKey === "stripe" ? "Copied!" : "Copy URL"}
            </button>
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
