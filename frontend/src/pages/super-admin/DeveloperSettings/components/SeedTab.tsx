import { useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Button } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function SeedTab() {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = strings.seed;

  async function runSeed() {
    setError(null);
    setOutput(null);
    setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/dev-settings/seed");
      setOutput(
        `✓ ${data.message}\nInstructor: ${data.instructor_email}\nNew Modules Created: ${data.created_modules}\nAvailable Types: ${(data.module_types ?? []).join(", ")}`
      );
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.seedError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      <div className="form-actions" style={{ display: "flex", gap: "12px" }}>
        <Button type="button" variant="primary" loading={busy} onClick={runSeed}>
          {busy ? t.populateBusy : t.populateIdle}
        </Button>
      </div>

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>{t.toastSectionTitle}</h4>
        <p className="hint" style={{ marginBottom: 14 }}>
          {t.toastSectionHint}
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ background: "var(--emerald-500)", color: "var(--white)", border: "none", borderRadius: "10px", padding: "10px 14px" }}
            onClick={() => useToastStore.getState().showSuccess(t.toastMessages.success.message, t.toastMessages.success.title)}
          >
            {t.toastButtons.success}
          </button>
          <button
            type="button"
            style={{ background: "var(--red-500)", color: "var(--white)", border: "none", borderRadius: "10px", padding: "10px 14px" }}
            onClick={() => useToastStore.getState().showError(t.toastMessages.error.message, t.toastMessages.error.title)}
          >
            {t.toastButtons.error}
          </button>
          <button
            type="button"
            style={{ background: "var(--amber-500)", color: "var(--white)", border: "none", borderRadius: "10px", padding: "10px 14px" }}
            onClick={() => useToastStore.getState().showWarning(t.toastMessages.warning.message, t.toastMessages.warning.title)}
          >
            {t.toastButtons.warning}
          </button>
          <button
            type="button"
            style={{ background: "var(--blue-500)", color: "var(--white)", border: "none", borderRadius: "10px", padding: "10px 14px" }}
            onClick={() => useToastStore.getState().showInfo(t.toastMessages.info.message, t.toastMessages.info.title)}
          >
            {t.toastButtons.info}
          </button>
        </div>
      </div>

      {error && <pre className="console-output error">{error}</pre>}
      {output && <pre className="console-output">{output}</pre>}
    </CollapsiblePanel>
  );
}
