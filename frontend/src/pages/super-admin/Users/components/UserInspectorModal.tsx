import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { IconName } from "@/components/icons";
import { Icon } from "@/components/icons";
import { TableAvatar } from "@/components/TableAvatar";
import { Badge, Button, SegmentedControl, type BadgeTone } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { useToastStore } from "@/store/toastStore";
import type { DirectoryRole, DirectoryUser, UserLinkedDetails } from "@/api/types";
import { formatCurrencyAmount } from "@/utils/currency";

interface UserInspectorModalProps {
  userId: number;
  onClose: () => void;
}

type InspectorTab = "overview" | "platform" | "institute" | "learning" | "attempts" | "billing" | "grading" | "security" | "activity";

interface InspectorTabConfig {
  id: InspectorTab;
  label: string;
  icon: IconName;
}

const roleTabMap: Record<DirectoryRole, InspectorTabConfig[]> = {
  SUPER_ADMIN: [
    { id: "overview", label: "Overview", icon: "user" },
    { id: "platform", label: "Platform", icon: "settings" },
    { id: "security", label: "Security", icon: "session" },
    { id: "activity", label: "Activity", icon: "logs" },
  ],
  SA_INSTRUCTOR: [
    { id: "overview", label: "Overview", icon: "user" },
    { id: "grading", label: "Grading", icon: "grading" },
    { id: "security", label: "Security", icon: "session" },
    { id: "activity", label: "Activity", icon: "logs" },
  ],
  INSTITUTE_ADMIN: [
    { id: "overview", label: "Overview", icon: "user" },
    { id: "institute", label: "Institute", icon: "building" },
    { id: "security", label: "Security", icon: "session" },
    { id: "activity", label: "Activity", icon: "logs" },
  ],
  INST_INSTRUCTOR: [
    { id: "overview", label: "Overview", icon: "user" },
    { id: "institute", label: "Institute", icon: "building" },
    { id: "grading", label: "Grading", icon: "grading" },
    { id: "security", label: "Security", icon: "session" },
    { id: "activity", label: "Activity", icon: "logs" },
  ],
  STUDENT: [
    { id: "overview", label: "Overview", icon: "user" },
    { id: "learning", label: "Courses", icon: "courses" },
    { id: "attempts", label: "Attempts", icon: "edit" },
    { id: "billing", label: "Billing", icon: "payment" },
    { id: "security", label: "Security", icon: "session" },
  ],
};

function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  return formatDate(value, { hour: "2-digit", minute: "2-digit" });
}

function parseUserAgent(ua: string | null | undefined): { browser: string; os: string } {
  if (!ua) return { browser: "Browser", os: "Device" };
  let browser = "Web Browser";
  let os = "Desktop Device";

  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

function roleBadgeTone(role: DirectoryUser["role_name"]): BadgeTone {
  if (role === "SUPER_ADMIN") return "red";
  if (role === "SA_INSTRUCTOR" || role === "INST_INSTRUCTOR") return "amber";
  if (role === "INSTITUTE_ADMIN") return "green";
  return "gray";
}

function roleLabel(role: DirectoryRole) {
  return role.replaceAll("_", " ");
}

function roleDescription(role: DirectoryRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Platform administration account";
    case "SA_INSTRUCTOR":
      return "Super Admin instructor account";
    case "INSTITUTE_ADMIN":
      return "Institute administration account";
    case "INST_INSTRUCTOR":
      return "Institute instructor account";
    case "STUDENT":
      return "Student learning account";
  }
}

function attemptScore(attempt: UserLinkedDetails["attempts"][number]) {
  if (attempt.band_label) return attempt.band_label;
  if (attempt.raw_score !== null && attempt.max_score !== null) return `${attempt.raw_score}/${attempt.max_score}`;
  return "-";
}

function subscriptionState(subscription: UserLinkedDetails["subscriptions"][number]) {
  if (subscription.cancelled_at) return { label: "Cancelled", tone: "inactive" as BadgeTone };
  if (subscription.expires_at && new Date(subscription.expires_at).getTime() < Date.now()) {
    return { label: "Expired", tone: "gray" as BadgeTone };
  }
  return { label: "Active", tone: "green" as BadgeTone };
}

type AuditLogEntry = UserLinkedDetails["audit_logs"][number];

const auditActionLabels: Record<string, string> = {
  "account.reset_password_via_email": "Password reset completed from email flow",
  "account.revoke_other_sessions": "Other active sessions revoked",
  "account.revoke_session": "One account session revoked",
  "account.update_avatar": "Profile avatar updated",
  "account.update_profile": "Profile details updated",
  "course.create": "Course created",
  "course.delete": "Course deleted",
  "course.update": "Course updated",
  "coupon.create": "Coupon created",
  "coupon.delete": "Coupon deleted",
  "coupon.update": "Coupon updated",
  "dev_settings.update_payment_gateways": "Developer payment gateway settings updated",
  "institute.create": "Institute created",
  "institute.reactivate": "Institute reactivated",
  "institute.suspend": "Institute suspended",
  "institute.update": "Institute updated",
  "institute_admin.archive": "Institute admin archived",
  "institute_admin.deactivate": "Institute admin deactivated",
  "institute_admin.reactivate": "Institute admin reactivated",
  "institute_admin.reset_password": "Institute admin password reset",
  "institute_member.reset_password": "Institute member password reset",
  "institute_member.revoke_sessions": "Institute member sessions revoked",
  "module.create": "Module created",
  "module.delete": "Module deleted",
  "module.update": "Module updated",
  "plan.create": "Plan created",
  "plan.delete": "Plan deleted",
  "plan.update": "Plan updated",
  "student.google_register": "Student registered with Google",
  "student.self_register": "Student self-registered",
  "subscription.assign": "Subscription assigned",
  "subscription.cancel": "Subscription cancelled",
  "subscription.subscribe": "Subscription purchased",
  "super_admin.revoke_user_session": "Super Admin revoked a user session",
  "terminal.command": "Terminal command executed",
  "terminal.open": "Terminal opened",
  "trial_config.update": "Trial configuration updated",
};

function humanizeToken(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actorLabel(log: AuditLogEntry) {
  if (!log.actor) return "System or deleted user";
  const fullName = `${log.actor.first_name} ${log.actor.last_name}`.trim();
  const identity = fullName || log.actor.email;
  return log.actor.role_name ? `${identity} (${roleLabel(log.actor.role_name)})` : identity;
}

function entityLabel(log: AuditLogEntry) {
  return `${humanizeToken(log.entity_type)}${log.entity_id !== null ? ` #${log.entity_id}` : ""}`;
}

function detailValueToText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(detailValueToText).join(", ");
  return JSON.stringify(value);
}

function detailEntries(details: AuditLogEntry["details"]) {
  return Object.entries(details ?? {}).map(([key, value]) => ({
    key,
    label: humanizeToken(key),
    value: detailValueToText(value),
  }));
}

function preferredDetail(details: AuditLogEntry["details"], keys: string[]) {
  for (const key of keys) {
    const value = details?.[key];
    if (value !== null && value !== undefined && value !== "") {
      return detailValueToText(value);
    }
  }
  return null;
}

function auditExplanation(log: AuditLogEntry) {
  const actor = actorLabel(log);
  const entity = entityLabel(log);
  const label = auditActionLabels[log.action] ?? humanizeToken(log.action);
  const [area, verb = "updated"] = log.action.split(".");
  const name = preferredDetail(log.details, ["name", "title", "course_title", "plan_title", "institute_name_snapshot"]);
  const email = preferredDetail(log.details, ["email", "admin_email", "target_email"]);
  const sessionId = preferredDetail(log.details, ["session_id"]);
  const revokedCount = preferredDetail(log.details, ["sessions_revoked", "count"]);

  if (log.action === "institute.create") {
    return {
      label,
      summary: `${actor} created ${entity}${name ? ` named “${name}”` : ""}${email ? ` with admin email ${email}` : ""}.`,
      impact: "A new institute record was added to the platform and can now be managed from Super Admin.",
    };
  }

  if (log.action === "super_admin.revoke_user_session") {
    return {
      label,
      summary: `${actor} revoked session #${sessionId ?? log.entity_id ?? "-"} for ${email ?? entity}.`,
      impact: "That browser/device can no longer refresh its login token and must sign in again.",
    };
  }

  if (log.action.includes("reset_password")) {
    return {
      label,
      summary: `${actor} reset the password for ${email ?? entity}.`,
      impact: revokedCount ? `${revokedCount} active session(s) were revoked as part of the reset.` : "The target user must use the newly issued password flow.",
    };
  }

  if (log.action.includes("revoke_sessions") || log.action.includes("revoke_other_sessions")) {
    return {
      label,
      summary: `${actor} revoked active login sessions for ${entity}.`,
      impact: revokedCount ? `${revokedCount} active session(s) were invalidated.` : "Affected devices must authenticate again.",
    };
  }

  if (log.action.endsWith(".deactivate") || log.action.endsWith(".suspend")) {
    return {
      label,
      summary: `${actor} disabled access for ${entity}${email ? ` (${email})` : ""}.`,
      impact: revokedCount ? `${revokedCount} active session(s) were also revoked.` : "The affected account or institute should not be able to continue normal access.",
    };
  }

  if (log.action.endsWith(".reactivate")) {
    return {
      label,
      summary: `${actor} restored access for ${entity}${email ? ` (${email})` : ""}.`,
      impact: "The affected account or institute can resume normal access according to its permissions.",
    };
  }

  if (log.action === "subscription.subscribe") {
    return {
      label,
      summary: `${actor} purchased a subscription${name ? ` to plan “${name}”` : ""}.`,
      impact: "A new paid plan subscription was activated for this account.",
    };
  }

  if (log.action === "subscription.cancel") {
    return {
      label,
      summary: `${actor} cancelled their subscription${name ? ` to plan “${name}”` : ""}.`,
      impact: "The subscription was set to expire at the end of the billing period.",
    };
  }

  if (log.action === "subscription.assign") {
    return {
      label,
      summary: `${actor} was assigned a subscription${name ? ` to plan “${name}”` : ""}.`,
      impact: "A plan subscription was assigned directly by an admin or instructor.",
    };
  }

  if (log.action === "account.update_profile") {
    return {
      label,
      summary: `${actor} updated profile details.`,
      impact: "Account details (such as name or phone number) were updated.",
    };
  }

  if (log.action === "account.update_avatar") {
    return {
      label,
      summary: `${actor} updated profile avatar.`,
      impact: "The profile image was uploaded and changed.",
    };
  }

  if (log.action === "terminal.command") {
    return {
      label,
      summary: `${actor} executed command in the admin terminal.`,
      impact: "An administrative shell command was run.",
    };
  }

  if (log.action === "terminal.open") {
    return {
      label,
      summary: `${actor} opened the admin terminal.`,
      impact: "An administrative terminal session was started.",
    };
  }

  if (verb === "create") {
    return {
      label,
      summary: `${actor} created ${entity}${name ? ` named “${name}”` : ""}.`,
      impact: `A new ${humanizeToken(area).toLowerCase()} record was added.`,
    };
  }

  if (verb === "update") {
    return {
      label,
      summary: `${actor} updated ${entity}${name ? ` (${name})` : ""}.`,
      impact: "The fields listed below were recorded with this change.",
    };
  }

  if (verb === "delete" || verb === "archive" || verb === "cancel") {
    return {
      label,
      summary: `${actor} ${verb === "delete" ? "deleted" : verb === "archive" ? "archived" : "cancelled"} ${entity}.`,
      impact: "This action changed availability or lifecycle status for the affected record.",
    };
  }

  return {
    label,
    summary: `${actor} completed the action "${label.toLowerCase()}" on ${entity}.`,
    impact: "Review the recorded fields below for the exact metadata saved with this event.",
  };
}

export function UserInspectorModal({ userId, onClose }: UserInspectorModalProps) {
  const [data, setData] = useState<UserLinkedDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [openAuditId, setOpenAuditId] = useState<number | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setData(null);
    setActiveTab("overview");
    setOpenAuditId(null);
    setRevokingSessionId(null);

    apiClient
      .get<UserLinkedDetails>(`/super-admin/users/${userId}/linked-details`)
      .then(({ data: payload }) => {
        if (mounted) setData(payload);
      })
      .catch((err: unknown) => {
        if (mounted) setError(extractErrorMessage(err, "Failed to load user details."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const displayName = useMemo(() => {
    if (!data) return "User profile";
    return `${data.user.first_name} ${data.user.last_name}`.trim() || data.user.email;
  }, [data]);
  const availableTabs = data ? roleTabMap[data.user.role_name] : roleTabMap.STUDENT;

  useEffect(() => {
    if (data && !availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, availableTabs, data]);

  const segmentedOptions = useMemo(() => {
    return availableTabs.map((tab) => ({
      value: tab.id,
      label: tab.label,
      icon: <Icon name={tab.icon} />,
    }));
  }, [availableTabs]);

  async function revokeSession(sessionId: number) {
    if (!data || revokingSessionId !== null) return;

    setRevokingSessionId(sessionId);
    try {
      const { data: updatedSession } = await apiClient.post<UserLinkedDetails["sessions"][number]>(
        `/super-admin/users/${data.user.id}/sessions/${sessionId}/revoke`,
      );
      setData((current) => current ? {
        ...current,
        sessions: current.sessions.map((session) => (
          session.id === updatedSession.id ? updatedSession : session
        )),
      } : current);
      showSuccess("Session revoked successfully.", "Session revoked");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to revoke session."), "Session revoke failed");
    } finally {
      setRevokingSessionId(null);
    }
  }

  return createPortal(
    <div className="user-inspector-backdrop" onClick={onClose} role="presentation">
      <aside
        className="user-inspector-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="User linked details"
      >
        <header className="user-inspector-header">
          <div className="user-inspector-identity">
            <TableAvatar
              src={data?.user.avatar_path ?? null}
              name={displayName}
              seed={String(userId)}
            />
            <div>
              <h2>{displayName}</h2>
              <p>{data ? `${data.user.email} · ${roleDescription(data.user.role_name)}` : "Loading account details..."}</p>
            </div>
          </div>
          <IconButton
            className="user-inspector-close"
            onClick={onClose}
            label="Close user details"
            icon={<Icon name="x" />}
          />
        </header>

        <div className="user-inspector-tabs-container">
          <SegmentedControl
            value={activeTab}
            onChange={(val) => setActiveTab(val as InspectorTab)}
            options={segmentedOptions}
            size="md"
          />
        </div>

        <div className="user-inspector-body">
          {loading && (
            <div className="user-inspector-empty">
              <div className="global-spinner" />
              <p>Retrieving user details...</p>
            </div>
          )}

          {error && (
            <div className="alert alert-danger">
              <Icon name="x" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {activeTab === "overview" && (
                <div className="user-inspector-section">
                  <div className="user-inspector-role-card">
                    <div>
                      <Badge tone={roleBadgeTone(data.user.role_name)}>
                        {roleLabel(data.user.role_name)}
                      </Badge>
                    </div>
                    <h3>{roleDescription(data.user.role_name)}</h3>
                    <p>
                      {data.user.institute_name
                        ? `Linked to ${data.user.institute_name}.`
                        : data.user.role_name === "STUDENT"
                          ? "Direct student account."
                          : "Platform-level account."}
                    </p>
                  </div>
                  <div className="user-inspector-field-grid">
                    <div className="user-inspector-field">
                      <label>Role</label>
                      <Badge tone={roleBadgeTone(data.user.role_name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
                        {roleLabel(data.user.role_name)}
                      </Badge>
                    </div>
                    <div className="user-inspector-field">
                      <label>Status</label>
                      <Badge tone={data.user.is_active ? "green" : "inactive"}>
                        {data.user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="user-inspector-field">
                      <label>Phone</label>
                      <span>{data.user.phone_number || "-"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Created</label>
                      <span>{formatDate(data.user.created_at)}</span>
                    </div>
                    <div className="user-inspector-field is-wide">
                      <label>Institute</label>
                      <span>{data.user.institute_name || "Platform account"}</span>
                    </div>
                    <div className="user-inspector-field is-wide">
                      <label>Address</label>
                      <span>{data.user.address || "-"}</span>
                    </div>
                  </div>

                  {data.instructor_metrics && (
                    <div className="user-inspector-metrics">
                      <h3>Instructor workload</h3>
                      <dl>
                        <div><dt>Pending</dt><dd>{data.instructor_metrics.pending_grading_count}</dd></div>
                        <div><dt>Claimed</dt><dd>{data.instructor_metrics.claimed_grading_count}</dd></div>
                        <div><dt>Completed</dt><dd>{data.instructor_metrics.completed_grading_count}</dd></div>
                        <div><dt>Graded parts</dt><dd>{data.instructor_metrics.total_graded_parts_count}</dd></div>
                      </dl>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "platform" && (
                <div className="user-inspector-section">
                  <h3>Platform access</h3>
                  <div className="user-inspector-field-grid">
                    <div className="user-inspector-field">
                      <label>Scope</label>
                      <span>All institutes and platform settings</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Owner account</label>
                      <span>{data.user.is_owner ? "Yes" : "No"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Password reset</label>
                      <span>{data.user.force_password_reset ? "Required" : "Not required"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Last password change</label>
                      <span>{data.user.password_changed_at ? formatDateTime(data.user.password_changed_at) : "-"}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "institute" && (
                <div className="user-inspector-section">
                  <h3>Institute role</h3>
                  <div className="user-inspector-field-grid">
                    <div className="user-inspector-field is-wide">
                      <label>Institute</label>
                      <span>{data.user.institute_name || "No institute linked"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Slug</label>
                      <span>{data.user.institute_slug || "-"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Institute ID</label>
                      <span>{data.user.institute_id ?? "-"}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Role</label>
                      <span>{roleLabel(data.user.role_name)}</span>
                    </div>
                    <div className="user-inspector-field">
                      <label>Status</label>
                      <span>{data.user.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "learning" && (
                <div className="user-inspector-section">
                  <h3>Enrolled courses</h3>
                  {data.enrollments.length === 0 ? (
                    <p className="user-inspector-muted">No enrolled courses found.</p>
                  ) : (
                    <div className="user-inspector-list">
                      {data.enrollments.map((enrollment) => (
                        <article key={enrollment.id} className="user-inspector-list-item">
                          <div>
                            <strong>{enrollment.course_title}</strong>
                            <span>Granted {formatDate(enrollment.granted_at)} via {enrollment.source}</span>
                          </div>
                          <Badge tone={enrollment.is_active ? "green" : "inactive"}>
                            {enrollment.is_active ? "Active" : "Expired"}
                          </Badge>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "attempts" && (
                <div className="user-inspector-section">
                  <h3>Test attempts</h3>
                  {data.attempts.length === 0 ? (
                    <p className="user-inspector-muted">No test attempts recorded.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table user-inspector-table">
                        <thead>
                          <tr>
                            <th>Module</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Started</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.attempts.map((attempt) => (
                            <tr key={attempt.id}>
                              <td>
                                <strong>{attempt.module_title}</strong>
                                {attempt.is_final && <Badge tone="red">Final</Badge>}
                              </td>
                              <td><Badge tone="gray">{attempt.status}</Badge></td>
                              <td>{attemptScore(attempt)}</td>
                              <td>{formatDate(attempt.started_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "billing" && (
                <div className="user-inspector-section">
                  <h3>Subscriptions</h3>
                  {data.subscriptions.length === 0 ? (
                    <p className="user-inspector-muted">No active or previous subscriptions.</p>
                  ) : (
                    <div className="user-inspector-list">
                      {data.subscriptions.map((subscription) => {
                        const state = subscriptionState(subscription);
                        return (
                          <article key={subscription.id} className="user-inspector-list-item">
                            <div>
                              <strong>{subscription.plan_title}</strong>
                              <span>{formatDate(subscription.starts_at)} to {formatDate(subscription.expires_at)}</span>
                            </div>
                            <Badge tone={state.tone}>{state.label}</Badge>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <h3>Payment history</h3>
                  {data.payments.length === 0 ? (
                    <p className="user-inspector-muted">No payment records found.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table user-inspector-table">
                        <thead>
                          <tr>
                            <th>Amount</th>
                            <th>Gateway</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.payments.map((payment) => (
                            <tr key={payment.id}>
                              <td>{formatCurrencyAmount(payment.final_amount)}</td>
                              <td>{payment.gateway.toUpperCase()}</td>
                              <td>
                                <Badge tone={payment.status === "paid" ? "green" : payment.status === "pending" ? "amber" : "inactive"}>
                                  {payment.status}
                                </Badge>
                              </td>
                              <td>{formatDate(payment.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "grading" && (
                <div className="user-inspector-section">
                  <h3>Grading workload</h3>
                  {data.instructor_metrics ? (
                    <div className="user-inspector-metrics is-large">
                      <dl>
                        <div><dt>Pending queue</dt><dd>{data.instructor_metrics.pending_grading_count}</dd></div>
                        <div><dt>Claimed tasks</dt><dd>{data.instructor_metrics.claimed_grading_count}</dd></div>
                        <div><dt>Completed queue</dt><dd>{data.instructor_metrics.completed_grading_count}</dd></div>
                        <div><dt>Total graded parts</dt><dd>{data.instructor_metrics.total_graded_parts_count}</dd></div>
                      </dl>
                    </div>
                  ) : (
                    <p className="user-inspector-muted">This role does not have grading workload.</p>
                  )}
                </div>
              )}

              {activeTab === "security" && (
                <div className="user-inspector-section">
                  <div className="user-inspector-section-heading">
                    <h3>Active & Historic Sessions</h3>
                    <span>
                      {data.sessions.filter((s) => s.is_active).length} Active Session(s)
                    </span>
                  </div>

                  {data.sessions.length === 0 ? (
                    <div className="user-inspector-empty-card">
                      <p className="user-inspector-muted" style={{ margin: 0 }}>No login sessions recorded.</p>
                    </div>
                  ) : (
                    <div className="user-inspector-session-list">
                      {data.sessions.map((session) => {
                        const { browser, os } = parseUserAgent(session.user_agent);
                        return (
                          <article 
                            key={session.id} 
                            className={`user-inspector-session-card ${session.is_active ? "is-active" : "is-revoked"}`}
                          >
                            {/* Card Header Row */}
                            <div className="user-inspector-session-header">
                              <div className="user-inspector-session-main">
                                <div className="user-inspector-session-icon">
                                  <Icon name="session" />
                                </div>
                                <div>
                                  <div className="user-inspector-session-title-row">
                                    <strong>{browser} on {os}</strong>
                                    <Badge tone={session.is_active ? "green" : "inactive"}>
                                      {session.is_active ? "Active" : "Revoked"}
                                    </Badge>
                                  </div>
                                  <div className="user-inspector-session-meta-row">
                                    <span className="user-inspector-session-ip">
                                      IP: {session.ip_address || "Unknown"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Button */}
                              {session.is_active && (
                                <Button
                                  size="small"
                                  variant="danger"
                                  loading={revokingSessionId === session.id}
                                  disabled={revokingSessionId !== null}
                                  onClick={() => void revokeSession(session.id)}
                                  leftIcon={<Icon name="revoke" />}
                                  className="user-inspector-revoke-button"
                                >
                                  Revoke Session
                                </Button>
                              )}
                            </div>

                            {/* User Agent Monospace Box */}
                            <div className="user-inspector-session-agent">
                              {session.user_agent || "No User Agent string recorded."}
                            </div>

                            {/* Timestamps Row */}
                            <div className="user-inspector-session-time-row">
                              <span>Created: <strong>{formatDateTime(session.created_at)}</strong></span>
                              <span>Expires: <strong>{formatDateTime(session.expires_at)}</strong></span>
                              {session.revoked_at && (
                                <span className="is-revoked-at">Revoked: <strong>{formatDateTime(session.revoked_at)}</strong></span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {activeTab === "activity" && (
                <div className="user-inspector-section">
                  <h3>Audit log</h3>
                  {data.audit_logs.length === 0 ? (
                    <p className="user-inspector-muted">No audit logs recorded.</p>
                  ) : (
                    <div className="user-inspector-audit-list">
                      {data.audit_logs.map((log) => (
                        <article key={log.id} className={openAuditId === log.id ? "is-open" : ""}>
                          <Button
                            type="button"
                            variant="ghost"
                            className="user-inspector-audit-row"
                            onClick={() => setOpenAuditId((current) => current === log.id ? null : log.id)}
                            aria-expanded={openAuditId === log.id}
                          >
                            <div>
                              <strong>{auditActionLabels[log.action] ?? humanizeToken(log.action)}</strong>
                              <span>{entityLabel(log)} · {actorLabel(log)} · {log.ip_address || "No IP"}</span>
                            </div>
                            <div className="user-inspector-audit-meta">
                              <time>{formatDateTime(log.created_at)}</time>
                              <Icon name={openAuditId === log.id ? "chevronDown" : "arrowRight"} />
                            </div>
                          </Button>
                          {openAuditId === log.id && (
                            <div className="user-inspector-audit-detail">
                              {(() => {
                                const explanation = auditExplanation(log);
                                const entries = detailEntries(log.details);

                                return (
                                  <>
                                    <section className="user-inspector-audit-explanation">
                                      <span>{explanation.label}</span>
                                      <strong>{explanation.summary}</strong>
                                      <p>{explanation.impact}</p>
                                    </section>
                                    <dl>
                                      <div><dt>Performed by</dt><dd>{actorLabel(log)}</dd></div>
                                      <div><dt>Affected record</dt><dd>{entityLabel(log)}</dd></div>
                                      <div><dt>Action code</dt><dd>{log.action}</dd></div>
                                      <div><dt>IP address</dt><dd>{log.ip_address || "-"}</dd></div>
                                      <div><dt>Created</dt><dd>{formatDateTime(log.created_at)}</dd></div>
                                    </dl>
                                    <label>Recorded fields</label>
                                    {entries.length > 0 ? (
                                      <div className="user-inspector-audit-fields">
                                        {entries.map((entry) => (
                                          <div key={entry.key}>
                                            <dt>{entry.label}</dt>
                                            <dd>{entry.value}</dd>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p>No extra metadata recorded for this action.</p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
