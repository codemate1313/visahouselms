import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Badge } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { formatDateTime } from "@/utils/date";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";
import { formatBytes } from "../helpers";
import type { BackupRow } from "../types";

interface BackupSettingsPayload {
  schedule: string;
  retention: string;
}

export function MaintenanceTab() {
  // Maintenance actions state
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const tMaint = strings.maintenance;

  // Backups state
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [schedule, setSchedule] = useState("none");
  const [retention, setRetention] = useState("5");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<BackupSettingsPayload | null>(null);
  const scheduleRef = useRef(schedule);
  const retentionRef = useRef(retention);
  const tBackup = strings.backups;

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);
  useEffect(() => {
    retentionRef.current = retention;
  }, [retention]);

  const loadBackups = useCallback(() => {
    apiClient.get("/super-admin/backups").then(({ data }) => setRows(data));
    apiClient.get("/super-admin/dev-settings/backup").then(({ data }) => {
      const nextSchedule = data.schedule || scheduleRef.current;
      const nextRetention = data.retention || retentionRef.current;
      if (data.schedule) setSchedule(data.schedule);
      if (data.retention) setRetention(data.retention);
      originalRef.current = { schedule: nextSchedule, retention: nextRetention };
    });
  }, []);

  useEffect(loadBackups, [loadBackups]);

  // --- Maintenance Polling & Actions ---
  async function pollJob(jobId: number): Promise<void> {
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data } = await apiClient.get(`/super-admin/dev-settings/jobs/${jobId}`);
      if (data.status === "done") {
        setOutput(tMaint.jobDoneMessage(jobId, data.result ?? ""));
        return;
      }
      if (data.status === "failed") {
        setError(tMaint.jobFailedMessage(jobId, data.result ?? ""));
        return;
      }
      setOutput(tMaint.jobRunningMessage(jobId, data.status));
    }
    setError(tMaint.jobTimeoutMessage(jobId));
  }

  async function runMigration() {
    const confirmed = await confirmAction(tMaint.migrateConfirmMessage, {
      title: tMaint.migrateConfirmTitle,
      confirmText: "Run Migration",
      variant: "danger",
    });
    if (!confirmed) return;
    await run("migrate", tMaint.migrate.label);
  }

  async function run(action: string, label: string) {
    setError(null);
    setOutput(null);
    setBusyAction(action);
    try {
      const { data } = await apiClient.post(`/super-admin/dev-settings/${action}`);
      if (data.job_id) {
        setOutput(tMaint.jobEnqueuedMessage(label, data.job_id));
        await pollJob(data.job_id);
      } else {
        setOutput(tMaint.genericResultMessage(label, JSON.stringify(data, null, 2)));
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, tMaint.actionFailed(label)));
    } finally {
      setBusyAction(null);
    }
  }

  // --- Backup Actions ---
  async function saveSettings() {
    const payload: BackupSettingsPayload = { schedule, retention };
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setBackupError(null);
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/backup", payload);
      originalRef.current = payload;
      setBackupNotice(tBackup.savedNotice);
    } catch (err: unknown) {
      setBackupError(extractErrorMessage(err, tBackup.saveError));
    } finally {
      setBackupBusy(false);
    }
  }

  async function backupNow() {
    setBackupError(null);
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/backups/run");
      setBackupNotice(tBackup.backupStartedNotice(data.job_id));
      setTimeout(loadBackups, 8000);
    } catch (err: unknown) {
      setBackupError(extractErrorMessage(err, tBackup.backupStartFailedError));
    } finally {
      setBackupBusy(false);
    }
  }

  async function download(row: BackupRow) {
    try {
      const response = await apiClient.get(`/super-admin/backups/${row.id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = row.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setBackupError(tBackup.downloadFailedError);
    }
  }

  async function restore(row: BackupRow) {
    const typed = window.prompt(`${tBackup.restorePromptPrefix} ${row.filename}.\n${tBackup.restorePromptSuffix}`);
    if (typed === null) return;
    setBackupError(null);
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      const { data } = await apiClient.post(`/super-admin/backups/${row.id}/restore`, {
        confirmation: typed,
      });
      setBackupNotice(data.message);
      loadBackups();
    } catch (err: unknown) {
      setBackupError(extractErrorMessage(err, tBackup.restoreFailedError));
    } finally {
      setBackupBusy(false);
    }
  }

  async function remove(row: BackupRow) {
    if (!(await confirmDelete(tBackup.deleteConfirmMessage(row.filename), tBackup.deleteConfirmTitle))) return;
    setBackupError(null);
    setBackupNotice(null);
    try {
      await apiClient.delete(`/super-admin/backups/${row.id}`);
      loadBackups();
    } catch (err: unknown) {
      setBackupError(extractErrorMessage(err, tBackup.deleteFailedError));
    }
  }

  return (
    <div>
      {/* 1. Maintenance Actions Panel */}
      <CollapsiblePanel className="form-card wide" title={tMaint.title} description={tMaint.description}>
        <div className="maintenance-actions">
          <button
            type="button"
            className="maintenance-btn-migrate"
            disabled={busyAction !== null}
            onClick={() => void runMigration()}
          >
            {busyAction === "migrate" ? tMaint.migrate.busy : tMaint.migrate.idle}
          </button>
          <button
            type="button"
            className="maintenance-btn-cache"
            disabled={busyAction !== null}
            onClick={() => run("clear-cache", tMaint.clearCache.label)}
          >
            {busyAction === "clear-cache" ? tMaint.clearCache.busy : tMaint.clearCache.idle}
          </button>
          <button
            type="button"
            className="maintenance-btn-storage"
            disabled={busyAction !== null}
            onClick={() => run("storage-link", tMaint.storageLink.label)}
          >
            {busyAction === "storage-link" ? tMaint.storageLink.busy : tMaint.storageLink.idle}
          </button>
        </div>
        {error && <pre className="console-output error">{error}</pre>}
        {output && <pre className="console-output">{output}</pre>}
      </CollapsiblePanel>

      {/* 2. Backup Schedule & Run Panel */}
      <CollapsiblePanel className="form-card wide" title={tBackup.scheduleTitle} description={tBackup.scheduleDescription}>
        <div className="form-grid">
          <div>
            <label>{tBackup.scheduleLabel}</label>
            <SearchableSelect
              options={tBackup.scheduleOptions}
              value={schedule}
              onChange={(value) => setSchedule(String(value))}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label>{tBackup.retentionLabel}</label>
            <input value={retention} onChange={(e) => setRetention(e.target.value)} />
          </div>
        </div>
        {backupError && <p className="error-text">{backupError}</p>}
        {backupNotice && <p className="success-text">{backupNotice}</p>}
        <div className="form-actions">
          <button disabled={backupBusy} onClick={saveSettings}>{tBackup.saveSettingsLabel}</button>
          <button disabled={backupBusy} onClick={backupNow}>{tBackup.backupNowLabel}</button>
        </div>
      </CollapsiblePanel>

      {/* 3. Backup Files Table Panel */}
      <CollapsiblePanel
        className="form-card wide table-card-collapsible"
        title={tBackup.filesTitle}
        description={tBackup.filesDescription}
        badge={<span className="count-chip">{rows.length}</span>}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tBackup.tableHeaders.file}</th>
                <th>{tBackup.tableHeaders.size}</th>
                <th>{tBackup.tableHeaders.kind}</th>
                <th>{tBackup.tableHeaders.status}</th>
                <th>{tBackup.tableHeaders.created}</th>
                <th className="table-actions-heading">{tBackup.tableHeaders.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">{tBackup.emptyMessage}</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.filename}</td>
                  <td>{formatBytes(row.size_bytes)}</td>
                  <td>{row.kind}</td>
                  <td>
                    <Badge tone={row.status === "done" ? "green" : "amber"}>{row.status}</Badge>
                  </td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td className="table-actions">
                    <button onClick={() => download(row)} aria-label="Download backup" data-tooltip="Download backup">
                      <Icon name="download" />
                    </button>
                    <button onClick={() => restore(row)} aria-label="Restore backup" data-tooltip="Restore backup">
                      <Icon name="restore" />
                    </button>
                    <button className="danger" onClick={() => remove(row)} aria-label="Delete backup" data-tooltip="Delete backup">
                      <Icon name="trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    </div>
  );
}

