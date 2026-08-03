import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { RetakeRequestView } from "@/api/types";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Badge, PageHeader, SearchableSelect } from "@/components/ui";
import { retakeRequestsStrings as strings } from "./RetakeRequests.strings";
import { formatDate } from "@/utils/date";

const STATUS_CLASS: Record<string, string> = {
  pending: "badge-amber",
  approved: "badge-green",
  rejected: "badge-red",
};

export function RetakeRequests() {
  const [requests, setRequests] = useState<RetakeRequestView[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolvingAction, setResolvingAction] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await apiClient.get<RetakeRequestView[]>("/super-admin/retake-requests", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setRequests(data);
      setError(null);
    } catch {
      setError(strings.loadError);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openResolve(id: number, action: "approved" | "rejected") {
    setResolvingId(id);
    setResolvingAction(action);
    setNote("");
    setError(null);
  }

  function closeResolve() {
    setResolvingId(null);
    setResolvingAction(null);
    setNote("");
  }

  async function confirmResolve() {
    if (resolvingId === null || resolvingAction === null) return;
    if (note.trim().length < 10) {
      setError(strings.noteTooShort);
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/super-admin/retake-requests/${resolvingId}/resolve`, {
        resolution: resolvingAction,
        note,
      });
      closeResolve();
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.resolveError));
    } finally {
      setSaving(false);
    }
  }

  if (error && !requests) return <p className="error-text">{error}</p>;
  if (!requests) return <p>{strings.loading}</p>;

  const t = strings.table;

  return (
    <div>
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      <div className="filter-bar">
        <SearchableSelect
          options={[
            { value: "", label: strings.filters.all },
            { value: "pending", label: strings.filters.pending },
            { value: "approved", label: strings.filters.approved },
            { value: "rejected", label: strings.filters.rejected },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(String(value))}
          placeholder={strings.filters.all}
          searchable={false}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <CollapsiblePanel
        className="workspace-panel"
        title={strings.register.title}
        description={strings.register.description}
        badge={<Badge tone="gray">{requests.length} {strings.register.recordsSuffix}</Badge>}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.student}</th>
                <th>{t.module}</th>
                <th>{t.reason}</th>
                <th>{t.status}</th>
                <th>{t.reviewedBy}</th>
                <th>{t.requested}</th>
                <th>{t.note}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    {strings.register.empty}
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div>{request.student_name}</div>
                      <div className="text-muted">{request.student_email}</div>
                    </td>
                    <td>{request.module_title}</td>
                    <td className="grading-reason-cell">{request.reason}</td>
                    <td>
                      <Badge tone={STATUS_CLASS[request.status] ?? "gray"}>{request.status}</Badge>
                    </td>
                    <td>{request.reviewed_by_name ?? "—"}</td>
                    <td>{formatDate(request.created_at)}</td>
                    <td>{request.review_note ?? "—"}</td>
                    <td>
                      {request.status === "pending" ? (
                        <div className="row-actions-inline">
                          <button type="button" className="secondary-button" onClick={() => openResolve(request.id, "approved")}>
                            {strings.actions.approve}
                          </button>
                          <button type="button" className="secondary-button danger" onClick={() => openResolve(request.id, "rejected")}>
                            {strings.actions.reject}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <ConfirmModal
        isOpen={resolvingId !== null}
        title={resolvingAction === "approved" ? strings.modal.approveTitle : strings.modal.rejectTitle}
        message={
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>{strings.modal.noteLabel}</label>
            <textarea
              rows={4}
              minLength={10}
              maxLength={4000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={strings.modal.notePlaceholder}
              style={{ width: "100%" }}
            />
          </div>
        }
        confirmText={resolvingAction === "approved" ? strings.actions.approve : strings.actions.reject}
        variant={resolvingAction === "approved" ? "primary" : "danger"}
        loading={saving}
        onConfirm={confirmResolve}
        onClose={closeResolve}
      />
    </div>
  );
}
