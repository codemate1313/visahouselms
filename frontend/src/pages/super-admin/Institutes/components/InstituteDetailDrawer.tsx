import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl/SegmentedControl";
import { SearchableSelect } from "@/components/ui/SearchableSelect/SearchableSelect";
import { LineChart, type LineChartDatum } from "@/components/charts/LineChart";
import "./InstituteDetailDrawer.css";

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
  ai_student_monthly_limit?: number;
  student_limit?: number;
  staff_limit?: number;
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
  const [admins, setAdmins] = useState<Member[]>([]);
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

  // Reset user filter when role filter changes to prevent invalid query combinations
  useEffect(() => {
    setActivityUserFilter("all");
  }, [activityRoleFilter]);

  // Load details, students, and instructors when drawer opens/institute changes
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
      apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=INSTITUTE_ADMIN`),
    ])
      .then(([detailsRes, studentsRes, instructorsRes, adminsRes]) => {
        setDetails(detailsRes.data);
        setStudents(studentsRes.data);
        setInstructors(instructorsRes.data);
        setAdmins(adminsRes.data);
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
      usersList = usersList.concat(
        admins.map((a) => ({ value: a.id, label: `${a.first_name} ${a.last_name}`, sublabel: "Admin" }))
      );
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
                {details?.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="drawer-title-details">
              <h2>{details?.name || "Loading..."}</h2>
              <span className="drawer-slug">slug: {details?.slug}</span>
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
              { value: "instructors", label: `Instructors (${instructors.length})` },
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
                    apiClient.get<Member[]>(`/super-admin/institutes/${instituteId}/members?role=INSTITUTE_ADMIN`),
                  ])
                    .then(([detailsRes, studentsRes, instructorsRes, adminsRes]) => {
                      setDetails(detailsRes.data);
                      setStudents(studentsRes.data);
                      setInstructors(instructorsRes.data);
                      setAdmins(adminsRes.data);
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
              <div className="drawer-spinner"></div>
            </div>
          ) : (
            <>
              {/* Tab 1: Overview & Plan */}
              {activeTab === "overview" && details && (
                <div className="drawer-tab-pane overview-pane">
                  <div className="drawer-card-grid">
                    <div className="neomorphic-card-widget">
                      <h3>Subscription Info</h3>
                      <div className="widget-field-row">
                        <span className="field-label">Status</span>
                        <span className={`badge ${details.subscription_state === "active" ? "badge-green" : "badge-gray"}`}>
                          {details.subscription_state.toUpperCase()}
                        </span>
                      </div>
                      <div className="widget-field-row">
                        <span className="field-label">Created At</span>
                        <span className="field-value">
                          {new Date(details.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="widget-field-row">
                        <span className="field-label">Contact Email</span>
                        <span className="field-value">{details.contact_email || "—"}</span>
                      </div>
                    </div>

                    <div className="neomorphic-card-widget">
                      <h3>Resource Allocation</h3>
                      <div className="widget-field-row">
                        <span className="field-label">AI Quota Cap</span>
                        <span className="field-value">
                          {details.ai_student_monthly_limit ? `${details.ai_student_monthly_limit} eval/student/mo` : "Unlimited eval/student/mo"}
                        </span>
                      </div>
                      <div className="widget-field-row">
                        <span className="field-label">Student Slots</span>
                        <span className="field-value">
                          {students.length} / {details.student_limit ?? "Unlimited"}
                        </span>
                      </div>
                      <div className="widget-field-row">
                        <span className="field-label">Instructor Slots</span>
                        <span className="field-value">
                          {instructors.length} / {details.staff_limit ?? "Unlimited"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Students List */}
              {activeTab === "students" && (
                <div className="drawer-tab-pane list-pane">
                  <div className="drawer-search-wrapper">
                    <Icon name="search" className="search-icon" />
                    <input
                      type="text"
                      className="drawer-pane-search-input"
                      placeholder="Search students by name or email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>

                  <div className="drawer-list-items">
                    {filteredStudents.length === 0 ? (
                      <div className="drawer-empty-state">No students found.</div>
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
                                <span className="indicator-dot"></span>
                                {s.active_session_count} active
                              </span>
                            )}
                            <span className={`badge ${s.is_active ? "badge-green" : "badge-gray"}`}>
                              {s.is_active ? "Active" : "Inactive"}
                            </span>
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
                  <div className="drawer-search-wrapper">
                    <Icon name="search" className="search-icon" />
                    <input
                      type="text"
                      className="drawer-pane-search-input"
                      placeholder="Search instructors by name or email..."
                      value={instructorSearch}
                      onChange={(e) => setInstructorSearch(e.target.value)}
                    />
                  </div>

                  <div className="drawer-list-items">
                    {filteredInstructors.length === 0 ? (
                      <div className="drawer-empty-state">No instructors found.</div>
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
                                <span className="indicator-dot"></span>
                                {i.active_session_count} active
                              </span>
                            )}
                            <span className={`badge ${i.is_active ? "badge-green" : "badge-gray"}`}>
                              {i.is_active ? "Active" : "Inactive"}
                            </span>
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

                  {/* Filter & Search Bar */}
                  <div className="activity-filters-row">
                    <div className="filter-select-col">
                      <label className="select-col-label">Filter Role</label>
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
                      <label className="select-col-label">Filter User</label>
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
                      <label className="select-col-label">Search Activity</label>
                      <div className="drawer-search-wrapper">
                        <Icon name="search" className="search-icon" />
                        <input
                          type="text"
                          className="drawer-pane-search-input"
                          placeholder="Search actions..."
                          value={activitySearch}
                          onChange={(e) => setActivitySearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Activity Feed List */}
                  <div className="drawer-activity-feed">
                    <h3>Recent Operations</h3>
                    {activities.length === 0 ? (
                      <div className="drawer-empty-state">No activity logs found.</div>
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
