import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Button, SegmentedControl, Textarea } from "@/components/ui";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToastStore } from "@/store/toastStore";
import { formatDate } from "@/utils/date";
import { instituteSignupsStrings as strings } from "./InstituteSignups.strings";
import type { InstituteSignupRequest, SignupStatus } from "./types";

const STATUS_TONE: Record<SignupStatus, "amber" | "green" | "gray"> = {
  pending: "amber",
  approved: "green",
  rejected: "gray",
};

/**
 * The Super Admin queue for public institute applications.
 *
 * Approving runs the normal institute-creation path and emails the applicant a
 * temporary password; the institute exists but has no subscription, so its
 * admin lands in the setup wizard rather than a working portal. Rejecting keeps
 * the row and emails the reviewer's own reason.
 */
export function InstituteSignups() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [status, setStatus] = useState<SignupStatus>("pending");
  const [rows, setRows] = useState<InstituteSignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<InstituteSignupRequest | null>(null);
  const [reason, setReason] = useState("");
  // Held in memory only: the server returns a temporary password once, and this
  // is the reviewer's single chance to relay it if the email never lands.
  const [approved, setApproved] = useState<InstituteSignupRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<InstituteSignupRequest[]>("/super-admin/institute-signups", {
        params: { status },
      });
      setRows(data);
      setLoadError(null);
    } catch {
      setLoadError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(row: InstituteSignupRequest) {
    setBusyId(row.id);
    try {
      const { data } = await apiClient.post<InstituteSignupRequest>(
        `/super-admin/institute-signups/${row.id}/approve`,
      );
      setApproved(data);
      showSuccess(strings.approvedBody(data.admin_email), strings.approvedTitle);
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.approve));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await apiClient.post(`/super-admin/institute-signups/${rejecting.id}/reject`, { reason });
      setRejecting(null);
      setReason("");
      await load();
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.reject));
    } finally {
      setBusyId(null);
    }
  }

  const f = strings.fields;

  return (
    <div>
      {loadError && <p className="error-text">{loadError}</p>}

      <div className="plan-audience-tabs">
        <SegmentedControl<SignupStatus>
          ariaLabel="Application status"
          options={strings.tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      {approved && (
        <section className="form-card wide signup-approved-card">
          <strong>{strings.approvedTitle}</strong>
          <p className="hint">{strings.approvedBody(approved.admin_email)}</p>
          {approved.admin_temp_password && (
            <>
              <span className="signup-field-label">{strings.tempPasswordLabel}</span>
              <code className="signup-temp-password">{approved.admin_temp_password}</code>
              <p className="hint">{strings.tempPasswordHint}</p>
            </>
          )}
          {approved.created_institute_id && (
            <Link to={`/super-admin/institutes/${approved.created_institute_id}`}>{strings.viewInstitute}</Link>
          )}
        </section>
      )}

      {loading ? (
        <p>{strings.loading}</p>
      ) : rows.length === 0 ? (
        <p className="empty-message">{strings.empty}</p>
      ) : (
        <div className="signup-request-list">
          {rows.map((row) => (
            <article className="form-card wide signup-request-card" key={row.id}>
              <header className="signup-request-head">
                <div>
                  <h3>{row.institute_name}</h3>
                  <span className="hint">
                    {f.submitted} {formatDate(row.created_at)}
                  </span>
                </div>
                <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
              </header>

              <dl className="signup-request-facts">
                <div>
                  <dt>{f.admin}</dt>
                  <dd>
                    {row.admin_first_name} {row.admin_last_name} · {row.admin_email}
                  </dd>
                </div>
                <div>
                  <dt>{f.contact}</dt>
                  <dd>{[row.contact_email, row.contact_phone].filter(Boolean).join(" · ")}</dd>
                </div>
                <div>
                  <dt>{f.location}</dt>
                  <dd>{[row.city, row.country].filter(Boolean).join(", ") || f.none}</dd>
                </div>
                <div>
                  <dt>{f.website}</dt>
                  <dd>{row.website || f.none}</dd>
                </div>
                <div>
                  <dt>{f.expected}</dt>
                  <dd>{row.expected_students != null ? `${row.expected_students}` : f.none}</dd>
                </div>
                <div>
                  <dt>{f.expectedInstructors}</dt>
                  <dd>{row.expected_instructors != null ? `${row.expected_instructors}` : f.none}</dd>
                </div>
                <div>
                  <dt>{f.interested}</dt>
                  <dd>{row.interested_plan_name || f.none}</dd>
                </div>
              </dl>

              {row.message && (
                <>
                  <span className="signup-field-label">{f.message}</span>
                  <p className="signup-request-message">{row.message}</p>
                </>
              )}

              {row.status === "rejected" && row.rejection_reason && (
                <>
                  <span className="signup-field-label">{f.reason}</span>
                  <p className="signup-request-message">{row.rejection_reason}</p>
                </>
              )}

              {row.reviewed_by && (
                <p className="hint">
                  {f.reviewedBy} {row.reviewed_by}
                  {row.reviewed_at ? ` · ${formatDate(row.reviewed_at)}` : ""}
                </p>
              )}

              {row.status === "pending" ? (
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="primary"
                    loading={busyId === row.id}
                    disabled={busyId !== null}
                    onClick={() => approve(row)}
                  >
                    {busyId === row.id ? strings.approving : strings.approve}
                  </Button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => {
                      setRejecting(row);
                      setReason("");
                    }}
                  >
                    {strings.reject}
                  </button>
                </div>
              ) : row.created_institute_id ? (
                <div className="form-actions">
                  <Link to={`/super-admin/institutes/${row.created_institute_id}`}>{strings.viewInstitute}</Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(rejecting)}
        title={strings.rejectModal.title}
        variant="warning"
        message={
          <div className="signup-reject-body">
            <p>{strings.rejectModal.body}</p>
            <label className="signup-field-label">{strings.rejectModal.label}</label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={strings.rejectModal.placeholder}
              maxLength={1000}
            />
          </div>
        }
        confirmText={strings.rejectModal.confirm}
        loading={busyId !== null && rejecting !== null}
        onConfirm={confirmReject}
        onClose={() => {
          setRejecting(null);
          setReason("");
        }}
      />
    </div>
  );
}
