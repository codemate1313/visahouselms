import { useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function MaintenanceTab() {
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const t = strings.maintenance;

  async function pollJob(jobId: number): Promise<void> {
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data } = await apiClient.get(`/super-admin/dev-settings/jobs/${jobId}`);
      if (data.status === "done") {
        setOutput(t.jobDoneMessage(jobId, data.result ?? ""));
        return;
      }
      if (data.status === "failed") {
        setError(t.jobFailedMessage(jobId, data.result ?? ""));
        return;
      }
      setOutput(t.jobRunningMessage(jobId, data.status));
    }
    setError(t.jobTimeoutMessage(jobId));
  }

  async function run(action: string, label: string) {
    setError(null); setOutput(null); setBusy(action);
    try {
      const { data } = await apiClient.post(`/super-admin/dev-settings/${action}`);
      if (data.job_id) {
        setOutput(t.jobEnqueuedMessage(label, data.job_id));
        await pollJob(data.job_id);
      } else {
        setOutput(t.genericResultMessage(label, JSON.stringify(data, null, 2)));
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.actionFailed(label)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      <div className="maintenance-actions">
        <button disabled={busy !== null} onClick={() => run("migrate", t.migrate.label)}>
          {busy === "migrate" ? t.migrate.busy : t.migrate.idle}
        </button>
        <button disabled={busy !== null} onClick={() => run("clear-cache", t.clearCache.label)}>
          {busy === "clear-cache" ? t.clearCache.busy : t.clearCache.idle}
        </button>
        <button disabled={busy !== null} onClick={() => run("storage-link", t.storageLink.label)}>
          {busy === "storage-link" ? t.storageLink.busy : t.storageLink.idle}
        </button>
      </div>
      {error && <pre className="console-output error">{error}</pre>}
      {output && <pre className="console-output">{output}</pre>}
    </CollapsiblePanel>
  );
}
