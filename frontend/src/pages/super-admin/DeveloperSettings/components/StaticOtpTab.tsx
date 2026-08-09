import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Badge, Checkbox } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useToastStore } from "@/store/toastStore";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

interface StaticOtpConfig {
  enabled: boolean;
  code: string;
}

export function StaticOtpTab() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [form, setForm] = useState<StaticOtpConfig>({
    enabled: true,
    code: "123456",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get<StaticOtpConfig>("/super-admin/dev-settings/static-otp")
      .then(({ data }) => {
        if (active) {
          setForm({
            enabled: data.enabled ?? true,
            code: data.code || "123456",
          });
        }
      })
      .catch((err) => {
        if (active) {
          showError(extractErrorMessage(err, "Failed to load static OTP settings"), "Error");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showError]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await apiClient.put<StaticOtpConfig>("/super-admin/dev-settings/static-otp", {
        enabled: form.enabled,
        code: form.code.trim() || "123456",
      });
      setForm({
        enabled: data.enabled ?? true,
        code: data.code || "123456",
      });
      showSuccess(strings.otp.saveSuccess, "Saved");
    } catch (err) {
      showError(extractErrorMessage(err, strings.otp.saveError), "Save Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="form-card wide p-6">
        <p className="text-secondary text-sm">Loading Static OTP settings...</p>
      </div>
    );
  }

  return (
    <form className="form-card wide collapsible-form-card" onSubmit={handleSubmit}>
      <CollapsiblePanel
        className="form-card-collapsible"
        title={strings.otp.title}
        description={strings.otp.description}
        badge={
          <Badge tone={form.enabled ? "green" : "gray"}>
            {form.enabled ? strings.otp.statusActive : strings.otp.statusInactive}
          </Badge>
        }
      >
        {/* Testing Mode Control Card */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: form.enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                  color: form.enabled ? "#10b981" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <Icon name="lock" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
                  Global Testing Mode
                </h3>
                <small style={{ color: "var(--text-muted)" }}>
                  Applies to all accounts (Students, Instructors, Super Admins, Institute Admins)
                </small>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: 0, cursor: "pointer", fontWeight: 600, userSelect: "none" }}>
              <Checkbox
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span style={{ color: "var(--text)" }}>{strings.otp.enabledLabel}</span>
            </label>
          </div>

          <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {strings.otp.enabledHint}
          </p>

          {/* Static OTP Code Field */}
          <div className="form-group" style={{ maxWidth: "340px", marginBottom: "0.5rem" }}>
            <label htmlFor="static-otp-code" style={{ display: "block", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>
              {strings.otp.codeLabel}
            </label>
            <input
              id="static-otp-code"
              type="text"
              className="input-text"
              style={{
                fontFamily: "monospace",
                textAlign: "center",
                letterSpacing: "0.25em",
                fontSize: "1.25rem",
                fontWeight: 700,
                padding: "0.6rem 1rem",
                borderRadius: "10px",
              }}
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder={strings.otp.codePlaceholder}
              maxLength={10}
              required
            />
            <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              All registration, login, and OTP verification requests will accept code{" "}
              <strong style={{ color: "var(--primary, #0284c7)", fontFamily: "monospace" }}>
                {form.code || "123456"}
              </strong>.
            </p>
          </div>
        </div>

        {/* Save Button Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", paddingTop: "0.5rem" }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: "0.65rem 1.75rem", borderRadius: "10px" }}>
            {saving ? "Saving Settings..." : strings.otp.saveLabel}
          </button>
        </div>
      </CollapsiblePanel>
    </form>
  );
}
