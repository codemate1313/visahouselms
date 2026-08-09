import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Checkbox } from "@/components/ui";
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
      <div className="surface-card p-6">
        <p className="text-secondary text-sm">Loading Static OTP settings...</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-primary">{strings.otp.title}</h2>
          <p className="text-sm text-secondary mt-1">{strings.otp.description}</p>
        </div>
        <Badge tone={form.enabled ? "success" : "info"}>
          {form.enabled ? strings.otp.statusActive : strings.otp.statusInactive}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 rounded-xl bg-surface-hover/50 border border-border/60 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            <div>
              <span className="font-semibold text-primary block">{strings.otp.enabledLabel}</span>
              <span className="text-xs text-secondary mt-0.5 block">{strings.otp.enabledHint}</span>
            </div>
          </label>
        </div>

        <div className="form-group max-w-sm">
          <label htmlFor="static-otp-code" className="form-label font-medium text-primary">
            {strings.otp.codeLabel}
          </label>
          <input
            id="static-otp-code"
            type="text"
            className="input-text font-mono text-center tracking-widest text-lg font-bold"
            value={form.code}
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            placeholder={strings.otp.codePlaceholder}
            maxLength={10}
            required
          />
          <p className="text-xs text-secondary mt-1">
            All registration, login, and OTP verification requests will accept code{" "}
            <strong className="text-primary font-mono">{form.code || "123456"}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : strings.otp.saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
