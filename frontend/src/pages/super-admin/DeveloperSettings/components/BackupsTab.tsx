import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { confirmDelete } from "@/components/confirmDialog";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { formatDateTime } from "@/utils/date";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";
import { formatBytes } from "../helpers";
import type { BackupRow } from "../types";
import { Badge } from "@/components/ui";

interface BackupSettingsPayload {
  schedule: string;
  retention: string;
}

export function BackupsTab() {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [schedule, setSchedule] = useState("none");
  const [retention, setRetention] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<BackupSettingsPayload | null>(null);
  // Kept in sync with the schedule/retention state so the settings fetch
  // below can compute the post-load snapshot without depending on a stale
  // closure over `schedule`/`retention` (load() has an empty dep array).
  const scheduleRef = useRef(schedule);
  const retentionRef = useRef(retention);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);
  useEffect(() => {
    retentionRef.current = retention;
  }, [retention]);
  const t = strings.backups;

  const load = useCallback(() => {
    apiClient.get("/super-admin/backups").then(({ data }) => setRows(data));
    apiClient.get("/super-admin/dev-settings/backup").then(({ data }) => {
      const nextSchedule = data.schedule || scheduleRef.current;
      const nextRetention = data.retention || retentionRef.current;
      if (data.schedule) setSchedule(data.schedule);
      if (data.retention) setRetention(data.retention);
      originalRef.current = { schedule: nextSchedule, retention: nextRetention };
    });
  }, []);

  useEffect(load, [load]);

  async function saveSettings() {
    const payload: BackupSettingsPayload = { schedule, retention };
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setError(null); setNotice(null); setBusy(true);
    try {
      await apiClient.put("/super-admin/dev-settings/backup", payload);
      originalRef.current = payload;
      setNotice(t.savedNotice);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveError));
    } finally {
      setBusy(false);
    }
  }

  async function backupNow() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post("/super-admin/backups/run");
      setNotice(t.backupStartedNotice(data.job_id));
      setTimeout(load, 8000);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.backupStartFailedError));
    } finally {
      setBusy(false);
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
      setError(t.downloadFailedError);
    }
  }

  async function restore(row: BackupRow) {
    const typed = window.prompt(`${t.restorePromptPrefix} ${row.filename}.\n${t.restorePromptSuffix}`);
    if (typed === null) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      const { data } = await apiClient.post(`/super-admin/backups/${row.id}/restore`, {
        confirmation: typed,
      });
      setNotice(data.message);
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.restoreFailedError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BackupRow) {
    if (!(await confirmDelete(t.deleteConfirmMessage(row.filename), t.deleteConfirmTitle))) return;
    setError(null); setNotice(null);
    try {
      await apiClient.delete(`/super-admin/backups/${row.id}`);
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.deleteFailedError));
    }
  }

  return (
    <div>
      <CollapsiblePanel className="form-card wide" title={t.scheduleTitle} description={t.scheduleDescription}>
        <div className="form-grid">
          <div>
            <label>{t.scheduleLabel}</label>
            <SearchableSelect
              options={t.scheduleOptions}
              value={schedule}
              onChange={(value) => setSchedule(String(value))}
              searchable={false}
              className="form-dropdown-select"
            />
          </div>
          <div>
            <label>{t.retentionLabel}</label>
            <input value={retention} onChange={(e) => setRetention(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        {notice && <p className="success-text">{notice}</p>}
        <div className="form-actions">
          <button disabled={busy} onClick={saveSettings}>{t.saveSettingsLabel}</button>
          <button disabled={busy} onClick={backupNow}>{t.backupNowLabel}</button>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        className="form-card wide table-card-collapsible"
        title={t.filesTitle}
        description={t.filesDescription}
        badge={<span className="count-chip">{rows.length}</span>}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.tableHeaders.file}</th>
                <th>{t.tableHeaders.size}</th>
                <th>{t.tableHeaders.kind}</th>
                <th>{t.tableHeaders.status}</th>
                <th>{t.tableHeaders.created}</th>
                <th className="table-actions-heading">{t.tableHeaders.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">{t.emptyMessage}</td>
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
