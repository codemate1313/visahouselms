import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, SegmentedControl, Textarea } from "@/components/ui";
import { ConfirmModal } from "@/components/ConfirmModal";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { useToastStore } from "@/store/toastStore";
import { formatDate } from "@/utils/date";
import { instituteSignupsStrings as strings } from "./InstituteSignups.strings";
import type { InstituteSignupRequest, SignupStatus } from "./types";
import "./InstituteSignups.css";

/* --------------------------------------------------------------------------
   Inline SVG Icons for Crisp, Dependency-Free Visuals
   -------------------------------------------------------------------------- */

function BuildingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function MessageSquareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * Super Admin review queue for incoming public institute applications.
 */
export function InstituteSignups() {
  const showError = useToastStore((state) => state.showError);

  const [status, setStatus] = useState<SignupStatus>("pending");
  const [rows, setRows] = useState<InstituteSignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<InstituteSignupRequest | null>(null);
  const [reason, setReason] = useState("");

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

  const navigate = useNavigate();

  function approveAndOnboard(row: InstituteSignupRequest) {
    navigate(`/super-admin/institutes/new?signup_id=${row.id}`, {
      state: { signup: row },
    });
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
    <div className="vh-signups-page">
      {loadError && <p className="error-text">{loadError}</p>}

      <div className="vh-signups-tabs-container">
        <SegmentedControl<SignupStatus>
          ariaLabel="Application status"
          options={strings.tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      {loading ? (
        <RouteLoadingState />
      ) : rows.length === 0 ? (
        <div className="vh-signups-empty">
          <div className="vh-signups-empty-icon">
            <BuildingIcon />
          </div>
          <h4>{strings.empty}</h4>
          <p>There are no {status} institute applications to display at this time.</p>
        </div>
      ) : (
        <div className="vh-signups-list">
          {rows.map((row) => {
            const formattedWebsite = row.website
              ? row.website.startsWith("http://") || row.website.startsWith("https://")
                ? row.website
                : `https://${row.website}`
              : null;

            return (
              <article className="vh-app-card" key={row.id}>
                {/* Header Row */}
                <header className="vh-app-card-header">
                  <div className="vh-app-institute-info">
                    <div className="vh-app-institute-avatar">
                      <BuildingIcon />
                    </div>
                    <div className="vh-app-institute-details">
                      <div className="vh-app-institute-title-row">
                        <h3 className="vh-app-institute-title">{row.institute_name}</h3>
                        <span className="vh-app-id-pill">#APP-{row.id}</span>
                        {row.interested_plan_name && (
                          <span className="vh-app-plan-tag">
                            <SparklesIcon /> {row.interested_plan_name}
                          </span>
                        )}
                      </div>
                      <div className="vh-app-meta-row">
                        <span className="vh-app-meta-item">
                          <CalendarIcon /> {f.submitted} {formatDate(row.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`vh-app-status-badge status-${row.status}`}>
                    {row.status === "pending" && <span className="vh-app-pulse-dot" />}
                    {row.status}
                  </div>
                </header>

                {/* Structured 3-Tile Info Grid */}
                <div className="vh-app-grid">
                  {/* Tile 1: Primary Administrator */}
                  <div className="vh-app-info-tile">
                    <div className="vh-app-tile-header">
                      <UserIcon /> Primary Administrator
                    </div>
                    <div className="vh-app-tile-body">
                      <div className="vh-app-detail-row" style={{ fontWeight: 600 }}>
                        {row.admin_first_name} {row.admin_last_name}
                      </div>
                      <div className="vh-app-detail-row">
                        <MailIcon />
                        <span>{row.admin_email}</span>
                      </div>
                      {row.contact_phone && (
                        <div className="vh-app-detail-row">
                          <PhoneIcon />
                          <span>{row.contact_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tile 2: Location & Contact */}
                  <div className="vh-app-info-tile">
                    <div className="vh-app-tile-header">
                      <MapPinIcon /> Location & Contact
                    </div>
                    <div className="vh-app-tile-body">
                      <div className="vh-app-detail-row">
                        <MapPinIcon />
                        <span>{[row.city, row.country].filter(Boolean).join(", ") || f.none}</span>
                      </div>
                      {row.contact_email && row.contact_email !== row.admin_email && (
                        <div className="vh-app-detail-row">
                          <MailIcon />
                          <span>{row.contact_email}</span>
                        </div>
                      )}
                      <div className="vh-app-detail-row">
                        <GlobeIcon />
                        {formattedWebsite ? (
                          <a href={formattedWebsite} target="_blank" rel="noopener noreferrer">
                            {row.website} <ExternalLinkIcon />
                          </a>
                        ) : (
                          <span>{f.none}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tile 3: Scale & Estimated Size */}
                  <div className="vh-app-info-tile">
                    <div className="vh-app-tile-header">
                      <UsersIcon /> Scale & Requirements
                    </div>
                    <div className="vh-app-tile-body">
                      <div className="vh-app-scale-chips">
                        <span className="vh-app-metric-chip" title="Expected Students">
                          <UsersIcon /> {row.expected_students != null ? `${row.expected_students} Students` : `0 Students`}
                        </span>
                        <span className="vh-app-metric-chip" title="Expected Instructors">
                          <GraduationCapIcon /> {row.expected_instructors != null ? `${row.expected_instructors} Instructors` : `0 Instructors`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applicant Note Message */}
                {row.message && (
                  <div className="vh-app-message-box">
                    <div className="vh-app-message-header">
                      <MessageSquareIcon /> {f.message}
                    </div>
                    <p className="vh-app-message-content">{row.message}</p>
                  </div>
                )}

                {/* Rejection Details */}
                {row.status === "rejected" && row.rejection_reason && (
                  <div className="vh-app-rejected-box">
                    <div className="vh-app-rejected-header">
                      <XIcon /> {f.reason}
                    </div>
                    <p className="vh-app-rejected-content">{row.rejection_reason}</p>
                  </div>
                )}

                {/* Footer Bar with Review Audit & Action Buttons */}
                <footer className="vh-app-card-footer">
                  <div className="vh-app-footer-meta">
                    {row.reviewed_by ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <ShieldCheckIcon /> {f.reviewedBy} <strong>{row.reviewed_by}</strong>
                        {row.reviewed_at ? ` · ${formatDate(row.reviewed_at)}` : ""}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                        <span className="vh-app-pulse-dot" style={{ color: "#d97706" }} /> Awaiting Super Admin review
                      </span>
                    )}
                  </div>

                  <div className="vh-app-footer-actions">
                    {row.status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="vh-app-btn-reject"
                          disabled={busyId !== null}
                          leftIcon={<XIcon />}
                          onClick={() => {
                            setRejecting(row);
                            setReason("");
                          }}
                        >
                          {strings.reject}
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={busyId !== null}
                          leftIcon={<CheckIcon />}
                          onClick={() => approveAndOnboard(row)}
                        >
                          {strings.approve}
                        </Button>
                      </>
                    ) : row.created_institute_id ? (
                      <Link to={`/super-admin/institutes/${row.created_institute_id}`} style={{ textDecoration: "none" }}>
                        <Button type="button" variant="primary" rightIcon={<ArrowRightIcon />}>
                          {strings.viewInstitute}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* Reject Confirmation Modal */}
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
