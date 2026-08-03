import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Checkbox, RequiredMark } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { trialConfigStrings as strings } from "./TrialConfig.strings";
import { DemoCoursePicker } from "./components/DemoCoursePicker";

export function TrialConfig() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [durationDays, setDurationDays] = useState("14");
  const [testLimit, setTestLimit] = useState("3");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/super-admin/trial-config")
      .then(({ data }) => {
        setDurationDays(String(data.trial_duration_days));
        setTestLimit(String(data.test_limit));
        setEnabled(data.is_enabled);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiClient.put("/super-admin/trial-config", {
        trial_duration_days: Number(durationDays),
        test_limit: Number(testLimit),
        is_enabled: enabled,
      });
      showSuccess(strings.notices.saved);
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, strings.errors.save);
      setError(errMsg);
      showError(errMsg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  return (
    <div>
      <h1>{strings.title}</h1>
      <p className="hint" style={{ marginBottom: 20 }}>
        {strings.description}
      </p>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <label className="toggle-row">
          <Checkbox checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{strings.trialEnabled}</span>
        </label>

        <div className="form-grid" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="duration">{strings.durationLabel}<RequiredMark /></label>
            <input id="duration" type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="test_limit">{strings.testLimitLabel}<RequiredMark /></label>
            <input id="test_limit" type="number" min="0" value={testLimit} onChange={(e) => setTestLimit(e.target.value)} required />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? strings.saving : strings.save}</button>
        </div>
      </form>

      <DemoCoursePicker />
    </div>
  );
}
