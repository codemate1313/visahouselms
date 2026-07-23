import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { confirmAction, confirmDelete } from "../../components/confirmDialog";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { ExamModule } from "../../api/types";

interface Assignment {
  id: number;
  institute_id: number;
  institute_name: string;
  is_active: boolean;
  assigned_at: string;
}

interface ManagedModule extends ExamModule {
  assignments: Assignment[];
}

interface Institute {
  id: number;
  name: string;
  is_active: boolean;
  onboarding_status: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ModuleControlDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [module, setModule] = useState<ManagedModule | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: moduleData }, { data: instituteData }] = await Promise.all([
      apiClient.get<ManagedModule>(`/super-admin/modules/${id}`),
      apiClient.get<Institute[]>("/super-admin/institutes"),
    ]);
    setModule(moduleData);
    setInstitutes(instituteData);
  }

  useEffect(() => {
    load().catch(() => setError("Failed to load course."));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  async function assign(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiClient.post(`/super-admin/modules/${id}/assignments`, {
        institute_id: Number(selected),
      });
      setSelected("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to assign course."));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(instituteId: number, instituteName: string) {
    const confirmed = await confirmAction(
      `Are you sure you want to revoke access to "${module?.title}" for ${instituteName}?`,
      {
        title: "Revoke Institute Access",
        confirmText: "Revoke access",
        cancelText: "Cancel",
        variant: "danger",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/super-admin/modules/${id}/assignments/${instituteId}`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to revoke access."));
    }
  }

  async function toggleVisibility() {
    if (!module) return;
    const willHide = module.is_visible;
    const confirmed = await confirmAction(
      willHide
        ? `Are you sure you want to hide "${module.title}" from the site? Students will no longer see this course.`
        : `Are you sure you want to publish "${module.title}" on the public site?`,
      {
        title: willHide ? "Hide Course" : "Make Course Visible",
        confirmText: willHide ? "Hide from site" : "Make visible",
        cancelText: "Cancel",
        variant: willHide ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.patch(`/super-admin/modules/${id}/visibility`, { is_visible: !willHide });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to change course visibility."));
    }
  }

  async function changeStatus(next: string) {
    if (!module) return;
    const isArchive = next === "archived";
    const confirmed = await confirmAction(
      isArchive
        ? `Are you sure you want to archive "${module.title}"? It will be removed from active listings.`
        : `Are you sure you want to publish "${module.title}"?`,
      {
        title: isArchive ? "Archive Course" : "Publish Course",
        confirmText: isArchive ? "Archive course" : "Publish course",
        cancelText: "Cancel",
        variant: isArchive ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.post(`/super-admin/modules/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to change course status."));
    }
  }

  async function remove() {
    if (!module) return;
    const confirmed = await confirmDelete(
      `Are you sure you want to permanently delete "${module.title}"? Existing attempt history will be retained, but the course will be removed.`,
      "Delete Course"
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/super-admin/modules/${id}`);
      navigate("/super-admin/modules");
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to delete course."));
    }
  }

  if (!module) return <div className="course-loading-state">{error || "Loading course details..."}</div>;

  const activeIds = new Set(
    module.assignments.filter((item) => item.is_active).map((item) => item.institute_id)
  );
  const available = institutes.filter(
    (item) => item.is_active && item.onboarding_status === "published" && !activeIds.has(item.id)
  );

  return (
    <div className="module-detail-page">
      {/* Top Header */}
      <div className="page-header module-detail-header">
        <div>
          <span className="page-eyebrow">Course Control</span>
          <h1>{module.title}</h1>
          <p className="page-subtitle">
            Created by <strong>{module.created_by_name}</strong> on {formatDate(module.created_at)}
          </p>
        </div>

        <Link to="/super-admin/modules" className="back-link-pill">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to course tree
        </Link>
      </div>

      {error && <div className="error-text detail-error-banner">{error}</div>}

      {/* Action Toolbar */}
      <div className="course-admin-actions-bar">
        <div className="action-buttons-group">
          <button type="button" className="btn-action-outline" onClick={toggleVisibility}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {module.is_visible ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
            {module.is_visible ? "Hide from site" : "Show on site"}
          </button>

          {module.status !== "published" && (
            <button type="button" className="btn-action-primary" onClick={() => changeStatus("published")}>
              Publish Course
            </button>
          )}

          {module.status === "published" && (
            <button type="button" className="btn-action-outline" onClick={() => changeStatus("archived")}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              Archive
            </button>
          )}

          <button type="button" className="btn-action-danger" onClick={remove}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete course
          </button>
        </div>
      </div>

      {/* Course Overview Card */}
      <div className="detail-card course-overview-card">
        <div className="overview-left">
          <div className="course-status-pills">
            <span
              className={`badge ${
                module.status === "published"
                  ? "badge-green"
                  : module.status === "draft"
                  ? "badge-amber"
                  : "badge-gray"
              }`}
            >
              {module.status.charAt(0).toUpperCase() + module.status.slice(1)}
            </span>
            {!module.is_visible && <span className="badge badge-gray">Hidden</span>}
          </div>

          <h2 className="overview-course-type">{module.module_label}</h2>
          <p className="overview-course-desc">{module.description || "No description provided."}</p>
        </div>

        <div className="overview-facts-grid">
          <div className="overview-fact-box">
            <span className="fact-label">Duration</span>
            <span className="fact-value">{module.duration_minutes} Minutes</span>
          </div>
          <div className="overview-fact-box">
            <span className="fact-label">Parts</span>
            <span className="fact-value">{module.part_count}</span>
          </div>
          <div className="overview-fact-box">
            <span className="fact-label">Questions</span>
            <span className="fact-value">{module.question_count}</span>
          </div>
          <div className="overview-fact-box">
            <span className="fact-label">Institutes</span>
            <span className="fact-value">{module.assignment_count}</span>
          </div>
        </div>
      </div>

      {/* Assign to Institute Section */}
      <CollapsiblePanel
        className="detail-card workspace-panel"
        title="Assign to institute"
        description="Grant this published module to an institute."
      >
        {module.status !== "published" ? (
          <div className="banner-warning-box">
            Publish the course before assigning it to an institute.
          </div>
        ) : (
          <form className="assign-institute-form" onSubmit={assign}>
            <SearchableSelect
              options={available.map((inst) => ({
                value: inst.id,
                label: inst.name,
              }))}
              value={selected}
              onChange={(val) => setSelected(String(val))}
              placeholder="Select a published institute..."
              searchPlaceholder="Type to search institute..."
              disabled={busy}
              emptyMessage="No available published institutes."
            />
            <button type="submit" className="grant-access-btn" disabled={busy || !selected}>
              {busy ? "Granting..." : "Grant access"}
            </button>
          </form>
        )}
      </CollapsiblePanel>

      {/* Institute Access Table Section */}
      <CollapsiblePanel
        className="detail-card access-table-panel"
        title="Institute access"
        description="Review active and revoked institute assignments."
        badge={<span className="count-chip">{module.assignments.length}</span>}
      >
        <div className="table-responsive-wrapper">
          <table className="data-table sleek-access-table">
            <thead>
              <tr>
                <th>Institute</th>
                <th>Assigned</th>
                <th>Status</th>
                <th style={{ textTransform: "none" }} />
              </tr>
            </thead>
            <tbody>
              {!module.assignments.length ? (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    Not assigned to any institute yet.
                  </td>
                </tr>
              ) : (
                module.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.institute_name}</strong>
                    </td>
                    <td>{formatDate(assignment.assigned_at)}</td>
                    <td>
                      <span className={`badge ${assignment.is_active ? "badge-green" : "badge-gray"}`}>
                        {assignment.is_active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="table-actions">
                      {assignment.is_active && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => revoke(assignment.institute_id, assignment.institute_name)}
                          aria-label="Revoke access"
                          data-tooltip="Revoke access"
                        >
                          <Icon name="revoke" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
