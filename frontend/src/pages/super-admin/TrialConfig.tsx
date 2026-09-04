import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Checkbox, RequiredMark, Button } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { trialConfigStrings as strings } from "./TrialConfig.strings";
import { DemoCoursePicker } from "./components/DemoCoursePicker";

// No test cap: a module can be sat once, so the demo course list below already
// decides how many tests a trial student gets. A second number could only
// disagree with it.
interface TrialConfigPayload {
  trial_duration_days: number;
  is_enabled: boolean;
}

export function TrialConfig() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showInfo = useToastStore((state) => state.showInfo);
  const [durationDays, setDurationDays] = useState("14");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef<TrialConfigPayload | null>(null);

  useEffect(() => {
    apiClient
      .get("/super-admin/trial-config")
      .then(({ data }) => {
        setDurationDays(String(data.trial_duration_days));
        setEnabled(data.is_enabled);
        originalRef.current = {
          trial_duration_days: Number(data.trial_duration_days),
          is_enabled: data.is_enabled,
        };
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: TrialConfigPayload = {
      trial_duration_days: Number(durationDays),
      is_enabled: enabled,
    };
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.put("/super-admin/trial-config", payload);
      originalRef.current = payload;
      showSuccess(strings.notices.saved);
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, strings.errors.save);
      setError(errMsg);
      showError(errMsg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <RouteLoadingState />;

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
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? strings.saving : strings.save}
          </Button>
        </div>
      </form>

      <DemoCoursePicker />
    </div>
  );
}
