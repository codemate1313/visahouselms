import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { SearchableSelect } from "@/components/ui/SearchableSelect/SearchableSelect";
import { Badge, ExportButtons, SearchInput } from "@/components/ui";
import { LineChart, type LineChartDatum } from "@/components/charts/LineChart";
import "./InstituteDetailDrawer.css";
import { formatDate } from "@/utils/date";
import { confirmExport } from "@/utils/confirmExport";
import { exportMembersExcel, exportMembersPDF } from "./memberExportHelpers";

interface InstituteDetailDrawerProps {
  instituteId: number | null;
  onClose: () => void;
}

interface InstituteDetails {
  id: number;
  name: string;
  slug: string;
  contact_email: string;
  is_active: boolean;
  onboarding_status: string;
  created_at: string;
  subscription_state: string;
  logo_url?: string;
  student_limit?: number;
  staff_limit?: number;
  admin_id?: number;
  admin_email?: string;
  admin_first_name?: string;
  admin_last_name?: string;
}

interface Member {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  active_session_count?: number;
}

interface ActivityLog {
  id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
}

export function InstituteDetailDrawer({ instituteId, onClose }: InstituteDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [details, setDetails] = useState<InstituteDetails | null>(null);
  const [students, setStudents] = useState<Member[]>([]);
  const [instructors, setInstructors] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [chartData, setChartData] = useState<LineChartDatum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab states for search/filter
  const [studentSearch, setStudentSearch] = useState("");
  const [instructorSearch, setInstructorSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityRoleFilter, setActivityRoleFilter] = useState<string>("all");
  const [activityUserFilter, setActivityUserFilter] = useState<string | number>("all");

  const [, startTransition] = useTransition();

  // Reset user filter when role filter changes
  useEffect(() => {
    setActivityUserFilter("all");
  }, [activityRoleFilter]);

  // Load details, students, and instructors when drawer opens
  useEffect(() => {
    if (!instituteId) return;

    setLoading(true);
    setError(null);
    setActiveTab("overview");
    setStudentSearch("");
    setInstructorSearch("");
    setActivitySearch("");
    setActivityRoleFilter("all");
    setActivityUserFilter("all");

    Promise.all([
      apiClient.get<InstituteDetails>(`/super-admin/institutes/${instituteId}`),
      apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=STUDENT`),
      apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=INST_INSTRUCTOR`),
    ])
      .then(([detailsRes, studentsRes, instructorsRes]) => {
        setDetails(detailsRes.data);
        setStudents(studentsRes.data);
        setInstructors(instructorsRes.data);
      })
      .catch((err) => {
        console.error("Error loading institute details drawer data:", err);
        setError("Failed to load institute data. Please close and try again.");
      })
      .finally(() => setLoading(false));
  }, [instituteId]);

  // Load activities and chart data when on activity tab or filters change
  useEffect(() => {
    if (!instituteId || activeTab !== "activity") return;

    const queryParams = new URLSearchParams();
    if (activityRoleFilter !== "all") {
      queryParams.append("role", activityRoleFilter);
    }
    if (activityUserFilter !== "all") {
      queryParams.append("user_id", String(activityUserFilter));
    }
    if (activitySearch.trim()) {
      queryParams.append("search", activitySearch.trim());
    }

    apiClient.get<{ activities: ActivityLog[]; chart_data: { time: string; count: number }[] }>(
      `/super-admin/institutes/${instituteId}/activity?${queryParams.toString()}`
    )
      .then((res) => {
        setActivities(res.data.activities);
        const formattedChartData = res.data.chart_data.map((d) => ({
          label: d.time,
          value: d.count,
        }));
        setChartData(formattedChartData);
      })
      .catch((err) => console.error("Error loading activity log:", err));
  }, [instituteId, activeTab, activityRoleFilter, activityUserFilter, activitySearch]);

  if (!instituteId) return null;

  // Prepare filterable lists
  const filteredStudents = students.filter(
    (s) =>
      !studentSearch ||
      s.first_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.last_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  async function handleExportStudentsPdf() {
    if (!await confirmExport("pdf", "students")) return;
    exportMembersPDF(filteredStudents, details?.name ?? "Institute", "Students");
  }

  async function handleExportStudentsExcel() {
    if (!await confirmExport("excel", "students")) return;
    exportMembersExcel(filteredStudents, details?.name ?? "Institute", "Students");
  }

  async function handleExportInstructorsPdf() {
    if (!await confirmExport("pdf", "instructors")) return;
    exportMembersPDF(filteredInstructors, details?.name ?? "Institute", "Instructors");
  }

  async function handleExportInstructorsExcel() {
    if (!await confirmExport("excel", "instructors")) return;
    exportMembersExcel(filteredInstructors, details?.name ?? "Institute", "Instructors");
  }

  const filteredInstructors = instructors.filter(
    (i) =>
      !instructorSearch ||
      i.first_name.toLowerCase().includes(instructorSearch.toLowerCase()) ||
      i.last_name.toLowerCase().includes(instructorSearch.toLowerCase()) ||
      i.email.toLowerCase().includes(instructorSearch.toLowerCase())
  );

  // Dynamic user list options based on selected role filter
  const activityUserOptions = (() => {
    let usersList: { value: number; label: string; sublabel: string }[] = [];
    if (activityRoleFilter === "all" || activityRoleFilter === "INSTITUTE_ADMIN") {
      if (details?.admin_id && details?.admin_email) {
        usersList.push({
          value: details.admin_id,
          label: `${details.admin_first_name || ""} ${details.admin_last_name || ""}`.trim() || details.admin_email,
          sublabel: "Admin",
        });
      }
    }
    if (activityRoleFilter === "all" || activityRoleFilter === "INST_INSTRUCTOR") {
      usersList = usersList.concat(
        instructors.map((i) => ({ value: i.id, label: `${i.first_name} ${i.last_name}`, sublabel: "Instructor" }))
      );
    }
    if (activityRoleFilter === "all" || activityRoleFilter === "STUDENT") {
      usersList = usersList.concat(
        students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}`, sublabel: "Student" }))
      );
    }

    const placeholderLabel =
      activityRoleFilter === "INSTITUTE_ADMIN"
        ? "All Admins"
        : activityRoleFilter === "INST_INSTRUCTOR"
          ? "All Instructors"
          : activityRoleFilter === "STUDENT"
            ? "All Students"
            : "All Users";

    return [{ value: "all", label: placeholderLabel }, ...usersList];
  })();

  const studentLimit = details?.student_limit ?? 0;
  const studentUsagePct = studentLimit > 0 ? Math.min(100, Math.round((students.length / studentLimit) * 100)) : 0;
  
  const staffLimit = details?.staff_limit ?? 0;
  const staffUsagePct = staffLimit > 0 ? Math.min(100, Math.round((instructors.length / staffLimit) * 100)) : 0;

  const hasInstructorSlots = Boolean(
    (details?.staff_limit != null && details.staff_limit > 0) || instructors.length > 0
  );

  return createPortal(
    <div className="institute-detail-drawer-overlay" onClick={onClose}>
      <div className="institute-detail-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <header className="drawer-header">
          <div className="drawer-header-left">
            {details?.logo_url ? (
              <img
                src={`${apiClient.defaults.baseURL || ""}${details.logo_url}`}
                className="drawer-logo"
                alt={details.name}
              />
            ) : (
              <div className="drawer-logo-fallback">
                {details?.name.slice(0, 2).toUpperCase() || "IN"}
              </div>
            )}
            <div className="drawer-title-details">
              <div className="drawer-title-row">
                <h2>{details?.name || "Loading..."}</h2>
                {details && (
                  <span className={`status-pill ${details.is_active ? "is-active" : "is-inactive"}`}>
                    <span className="status-dot" />
                    {details.is_active ? "Active" : "Inactive"}
                  </span>
                )}
              </div>
              <span className="drawer-slug">slug: @{details?.slug}</span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close drawer">
            <Icon name="cross" />
          </button>
        </header>

        {/* Tab Navigator */}
        <div className="drawer-nav-container">
          <SegmentedControl
            options={[
              { value: "overview", label: "Overview & Plan" },
              { value: "students", label: `Students (${students.length})` },
              ...(hasInstructorSlots ? [{ value: "instructors", label: `Instructors (${instructors.length})` }] : []),
              { value: "activity", label: "Live Activity" },
            ]}
            value={activeTab}
            onChange={(tab) => startTransition(() => setActiveTab(tab))}
            className="drawer-segmented-tabs"
          />
        </div>

        {/* Content Body */}
        <div className="drawer-content-scroll">
          {error ? (
            <div className="drawer-error-container">
              <Icon name="help" className="error-icon" />
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  Promise.all([
                    apiClient.get<InstituteDetails>(`/super-admin/institutes/${instituteId}`),
                    apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=STUDENT`),
                    apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=INST_INSTRUCTOR`),
                  ])
                    .then(([detailsRes, studentsRes, instructorsRes]) => {
                      setDetails(detailsRes.data);
                      setStudents(studentsRes.data);
                      setInstructors(instructorsRes.data);
                    })
                    .catch((err) => {
                      console.error("Error loading institute details drawer data:", err);
                      setError("Failed to load institute data. Please close and try again.");
                    })
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="drawer-spinner-container">
              <div className="drawer-spinner" />
            </div>
          ) : (
            <>
              {/* Tab 1: Overview & Plan */}
              {activeTab === "overview" && details && (
                <div className="drawer-tab-pane overview-pane">
                  {/* Hero Metric Quick Stats */}
                  <div className={`drawer-stats-row ${hasInstructorSlots ? "has-3-cols" : "has-2-cols"}`}>
                    <div className="drawer-stat-card">
                      <span className="stat-card-label">Students</span>
                      <span className="stat-card-value">{students.length}</span>
                      <span className="stat-card-sub">
                        {details.student_limit ? `Limit: ${details.student_limit}` : "Unlimited slots"}
                      </span>
                    </div>
                    {hasInstructorSlots && (
                      <div className="drawer-stat-card">
                        <span className="stat-card-label">Instructors</span>
                        <span className="stat-card-value">{instructors.length}</span>
                        <span className="stat-card-sub">
                          {details.staff_limit ? `Limit: ${details.staff_limit}` : "Unlimited slots"}
                        </span>
                      </div>
                    )}
                    <div className="drawer-stat-card">
                      <span className="stat-card-label">Plan Status</span>
                      <span className={`stat-card-badge ${details.subscription_state === "active" ? "is-green" : "is-gray"}`}>
                        {details.subscription_state.toUpperCase()}
                      </span>
                      <span className="stat-card-sub">Subscribed</span>
                    </div>
                  </div>

                  <div className="drawer-card-grid">
                    {/* Capacity Progress Bar Widget */}
                    <div className="neomorphic-card-widget">
                      <h3>Seat Capacity & Usage</h3>

                      <div className="capacity-progress-item">
                        <div className="capacity-header">
                          <span className="capacity-title">Student Slots</span>
                          <span className="capacity-numbers">
                            {students.length} / {details.student_limit ? details.student_limit : "Unlimited"}
                          </span>
                        </div>
                        <div className="capacity-bar-track">
                          <div
                            className="capacity-bar-fill"
                            style={{ width: details.student_limit ? `${studentUsagePct}%` : "100%" }}
                          />
                        </div>
                      </div>

                      {hasInstructorSlots && (
                        <div className="capacity-progress-item">
                          <div className="capacity-header">
                            <span className="capacity-title">Instructor Slots</span>
                            <span className="capacity-numbers">
                              {instructors.length} / {details.staff_limit ? details.staff_limit : "Unlimited"}
                            </span>
                          </div>
                          <div className="capacity-bar-track">
                            <div
                              className="capacity-bar-fill is-purple"
                              style={{ width: details.staff_limit ? `${staffUsagePct}%` : "100%" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subscription & Contact Info */}
                    <div className="neomorphic-card-widget">
                      <h3>Subscription & Details</h3>
                      
                      <div className="widget-field-row">
                        <span className="field-label">Created Date</span>
                        <span className="field-value">
                          {formatDate(details.created_at)}
                        </span>
                      </div>
                      <div className="widget-field-row">
                        <span className="field-label">Contact Email</span>
                        <span className="field-value">{details.contact_email || "—"}</span>
                      </div>
                      {details.admin_email && (
                        <div className="widget-field-row">
                          <span className="field-label">Institute Admin</span>
                          <span className="field-value">
                            {details.admin_first_name} {details.admin_last_name} ({details.admin_email})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Students List */}
              {activeTab === "students" && (
                <div className="drawer-tab-pane list-pane">
                  <div className="drawer-filter-bar">
                    <SearchInput
                      value={studentSearch}
                      onChange={setStudentSearch}
                      placeholder="Search students by name or email..."
                      fullWidth
                    />
                    <ExportButtons
                      onExportPdf={() => void handleExportStudentsPdf()}
                      onExportExcel={() => void handleExportStudentsExcel()}
                      pdfLabel="Export Students PDF"
                      excelLabel="Export Students Excel"
                    />
                  </div>

                  <div className="drawer-list-items">
                    {filteredStudents.length === 0 ? (
                      <div className="drawer-empty-state">
                        <Icon name="search" />
                        <p>No students found.</p>
                      </div>
                    ) : (
                      filteredStudents.map((s) => (
                        <div key={s.id} className="drawer-list-item-card">
                          <div className="item-card-left">
                            <div className="item-avatar-fallback">
                              {s.first_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="item-card-text">
                              <h4>{s.first_name} {s.last_name}</h4>
                              <span className="item-sub">{s.email}</span>
                            </div>
                          </div>
                          <div className="item-card-right">
                            {s.active_session_count !== undefined && s.active_session_count > 0 && (
                              <span className="live-indicator">
                                <span className="indicator-dot" />
                                {s.active_session_count} active
                              </span>
                            )}
                            <Badge tone={s.is_active ? "green" : "gray"}>
                              {s.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Instructors List */}
              {activeTab === "instructors" && (
                <div className="drawer-tab-pane list-pane">
                  <div className="drawer-filter-bar">
                    <SearchInput
                      value={instructorSearch}
                      onChange={setInstructorSearch}
                      placeholder="Search instructors by name or email..."
                      fullWidth
                    />
                    <ExportButtons
                      onExportPdf={() => void handleExportInstructorsPdf()}
                      onExportExcel={() => void handleExportInstructorsExcel()}
                      pdfLabel="Export Instructors PDF"
                      excelLabel="Export Instructors Excel"
                    />
                  </div>

                  <div className="drawer-list-items">
                    {filteredInstructors.length === 0 ? (
                      <div className="drawer-empty-state">
                        <Icon name="search" />
                        <p>No instructors found.</p>
                      </div>
                    ) : (
                      filteredInstructors.map((i) => (
                        <div key={i.id} className="drawer-list-item-card">
                          <div className="item-card-left">
                            <div className="item-avatar-fallback instructor-avatar">
                              {i.first_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="item-card-text">
                              <h4>{i.first_name} {i.last_name}</h4>
                              <span className="item-sub">{i.email}</span>
                            </div>
                          </div>
                          <div className="item-card-right">
                            {i.active_session_count !== undefined && i.active_session_count > 0 && (
                              <span className="live-indicator">
                                <span className="indicator-dot" />
                                {i.active_session_count} active
                              </span>
                            )}
                            <Badge tone={i.is_active ? "green" : "gray"}>
                              {i.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Live Activity */}
              {activeTab === "activity" && (
                <div className="drawer-tab-pane activity-pane">
                  {/* Activity Line Chart */}
                  <div className="neomorphic-card-widget chart-widget">
                    <LineChart
                      data={chartData}
                      title="Actions per Hour (Last 24 Hours)"
                      color="var(--primary)"
                    />
                  </div>

                  {/* Filter & Search Controls */}
                  <div className="activity-filters-grid">
                    <div className="filter-select-col">
                      <label className="select-col-label">FILTER ROLE</label>
                      <SearchableSelect
                        options={[
                          { value: "all", label: "All Roles" },
                          { value: "INSTITUTE_ADMIN", label: "Admins" },
                          { value: "INST_INSTRUCTOR", label: "Instructors" },
                          { value: "STUDENT", label: "Students" },
                        ]}
                        value={activityRoleFilter}
                        onChange={(val) => setActivityRoleFilter(String(val))}
                        placeholder="All Roles"
                        searchable={false}
                        className="activity-role-select"
                      />
                    </div>
                    <div className="filter-select-col">
                      <label className="select-col-label">FILTER USER</label>
                      <SearchableSelect
                        options={activityUserOptions}
                        value={activityUserFilter}
                        onChange={(val) => setActivityUserFilter(val)}
                        placeholder="All Users"
                        searchPlaceholder="Filter users..."
                        className="activity-user-select"
                      />
                    </div>
                    <div className="filter-search-col">
                      <label className="select-col-label">SEARCH ACTIVITY</label>
                      <SearchInput
                        value={activitySearch}
                        onChange={setActivitySearch}
                        placeholder="Search actions..."
                        fullWidth
                      />
                    </div>
                  </div>

                  {/* Activity Feed List */}
                  <div className="drawer-activity-feed">
                    <h3>Recent Operations</h3>
                    {activities.length === 0 ? (
                      <div className="drawer-empty-state">
                        <Icon name="history" />
                        <p>No activity logs found matching your filters.</p>
                      </div>
                    ) : (
                      activities.map((act) => (
                        <div key={act.id} className="activity-feed-card">
                          <div className="activity-card-header">
                            <span className="activity-user-name">
                              {act.user_name}
                              <span className="activity-user-role-badge">
                                {act.user_role}
                              </span>
                            </span>
                            <span className="activity-time">
                              {new Date(act.created_at).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="activity-action-text">{act.action}</div>
                          {act.details && Object.keys(act.details).length > 0 && (
                            <pre className="activity-details-json">
                              {JSON.stringify(act.details, null, 2)}
                            </pre>
                          )}
                          <div className="activity-ip">IP: {act.ip_address ?? "Unknown"}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
