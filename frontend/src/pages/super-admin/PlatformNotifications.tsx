import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import type { Announcement, TargetInstituteOption, TargetStudentOption } from "../../api/types";
import { Icon, type IconName } from "../../components/icons";
import { usePageTitleStore } from "../../store/pageTitleStore";

interface TargetOptions {
  institutes: TargetInstituteOption[];
  students: TargetStudentOption[];
}

interface AudienceCardOption {
  key: string;
  title: string;
  iconName: IconName;
  desc: string;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) : "Draft";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

const AUDIENCE_CARDS: AudienceCardOption[] = [
  { key: "students", title: "Students", iconName: "instructors", desc: "All platform students" },
  { key: "staff", title: "Staff", iconName: "admin", desc: "Instructors & administrators" },
  { key: "institutes", title: "Specific Institutes", iconName: "building", desc: "Select custom institutes" },
  { key: "specific_students", title: "Specific Students", iconName: "user", desc: "Select individual students" },
  { key: "all", title: "Everyone", iconName: "products", desc: "All users on the platform" },
];

export function PlatformNotifications() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targetOptions, setTargetOptions] = useState<TargetOptions>({ institutes: [], students: [] });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["students"]);
  const [selectedInstituteIds, setSelectedInstituteIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [status, setStatus] = useState<"published" | "scheduled" | "draft">("published");
  const [scheduledAt, setScheduledAt] = useState("");

  const [instituteSearch, setInstituteSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "PUBLISHED" | "SCHEDULED" | "DRAFT">("ALL");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  async function loadData() {
    try {
      const [announcementsRes, optionsRes] = await Promise.all([
        apiClient.get<Announcement[]>("/super-admin/announcements"),
        apiClient.get<TargetOptions>("/super-admin/announcements/target-options"),
      ]);
      setAnnouncements(announcementsRes.data);
      setTargetOptions(optionsRes.data);
      setError(null);
    } catch {
      setError("Notifications or targeting options could not be loaded.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setItemCount(announcements.length);
    return () => setItemCount(null);
  }, [announcements.length, setItemCount]);

  function toggleAudienceCard(key: string) {
    if (key === "all") {
      if (selectedAudiences.includes("all")) {
        setSelectedAudiences(["students"]);
      } else {
        setSelectedAudiences(["all"]);
      }
      return;
    }

    let next = selectedAudiences.filter((a) => a !== "all");
    if (key === "institutes" || key === "specific_students") {
      next = next.filter((a) => a !== "students");
    }
    if (key === "students") {
      next = next.filter((a) => a !== "institutes" && a !== "specific_students");
      setSelectedInstituteIds([]);
      setSelectedUserIds([]);
    }
    if (next.includes(key)) {
      next = next.filter((a) => a !== key);
    } else {
      next.push(key);
    }

    if (next.length === 0) {
      next = ["students"];
    }
    setSelectedAudiences(next);
  }

  function toggleInstitute(id: number) {
    if (selectedInstituteIds.includes(id)) {
      setSelectedInstituteIds(selectedInstituteIds.filter((i) => i !== id));
    } else {
      setSelectedInstituteIds([...selectedInstituteIds, id]);
    }
  }

  function toggleStudent(id: number) {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((i) => i !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  }

  async function deleteAnnouncement(id: number) {
    if (!window.confirm("Are you sure you want to delete this notification?")) return;
    try {
      await apiClient.delete(`/super-admin/announcements/${id}`);
      await loadData();
    } catch {
      setError("Failed to delete notification.");
    }
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (status === "scheduled" && !scheduledAt) {
      setError("Please select a date and time for scheduled notification.");
      setBusy(false);
      return;
    }
    if (selectedAudiences.includes("institutes") && selectedInstituteIds.length === 0) {
      setError("Please select at least one target institute.");
      setBusy(false);
      return;
    }
    if (selectedAudiences.includes("specific_students") && selectedUserIds.length === 0) {
      setError("Please select at least one target student.");
      setBusy(false);
      return;
    }

    const payload = {
      title,
      message,
      audience: selectedAudiences.join(","),
      status,
      scheduled_at: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      target_institute_ids: selectedAudiences.includes("institutes") ? selectedInstituteIds : [],
      target_user_ids: selectedAudiences.includes("specific_students") ? selectedUserIds : [],
    };

    try {
      await apiClient.post("/super-admin/announcements", payload);
      setTitle("");
      setMessage("");
      setSelectedAudiences(["students"]);
      setSelectedInstituteIds([]);
      setSelectedUserIds([]);
      setStatus("published");
      setScheduledAt("");
      await loadData();
    } catch {
      setError("Notification could not be saved or published.");
    } finally {
      setBusy(false);
    }
  }

  const instituteQuery = normalizeSearch(instituteSearch);
  const filteredInstitutes = targetOptions.institutes
    .filter((inst) => {
      const haystack = [inst.name, inst.slug, String(inst.id), inst.onboarding_status, inst.is_active ? "active" : "inactive"]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !instituteQuery || haystack.includes(instituteQuery);
    })
    .sort((a, b) => Number(selectedInstituteIds.includes(b.id)) - Number(selectedInstituteIds.includes(a.id)) || a.name.localeCompare(b.name));

  const studentQuery = normalizeSearch(studentSearch);
  const filteredStudents = targetOptions.students
    .filter((st) => {
      const haystack = [st.name, st.email, String(st.id), st.institute_id ? String(st.institute_id) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !studentQuery || haystack.includes(studentQuery);
    })
    .sort((a, b) => Number(selectedUserIds.includes(b.id)) - Number(selectedUserIds.includes(a.id)) || a.name.localeCompare(b.name));

  const filteredAnnouncements = announcements.filter((item) => {
    const q = historySearch.trim().toLowerCase();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.message.toLowerCase().includes(q);
    const matchesStatus =
      historyStatusFilter === "ALL" ||
      item.status.toUpperCase() === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="announcement-admin-page">
      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}
      
      <div className="announcement-admin-grid">
        {/* Left Section: Create / Publish Form */}
        <div className="pn-card pn-publisher-card">
          <div className="pn-card-header">
            <div>
              <h2 className="pn-card-title">New Platform Notification</h2>
              <p className="pn-card-subtitle">Publish a targeted or scheduled announcement with custom audience selection.</p>
            </div>
          </div>

          <form onSubmit={(event) => void publish(event)} className="pn-form">
            <div className="pn-form-group">
              <label htmlFor="platform-notification-title">Notification Title</label>
              <input
                id="platform-notification-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Scheduled System Maintenance"
                required
                className="pn-input"
              />
            </div>

            <div className="pn-form-group">
              <label htmlFor="platform-notification-message">Message Content</label>
              <textarea
                id="platform-notification-message"
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write detailed notification content..."
                required
                className="pn-textarea"
              />
            </div>

            <div className="pn-form-group">
              <label>Target Audience</label>
              <div className="pn-audience-grid">
                {AUDIENCE_CARDS.map((card) => {
                  const isSelected = selectedAudiences.includes(card.key);
                  return (
                    <div
                      key={card.key}
                      className={`pn-audience-card ${isSelected ? "is-selected" : ""}`}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => toggleAudienceCard(card.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleAudienceCard(card.key);
                        }
                      }}
                    >
                      <div className="pn-audience-icon-wrapper">
                        <Icon name={card.iconName} />
                      </div>
                      <div className="pn-audience-info">
                        <strong>{card.title}</strong>
                        <span>{card.desc}</span>
                      </div>
                      <div className="pn-audience-checkbox">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedAudiences.includes("institutes") && (
              <div className="pn-target-container">
                <div className="pn-target-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="building" />
                    <span>Select Target Institutes ({selectedInstituteIds.length} selected)</span>
                  </div>
                  {selectedInstituteIds.length > 0 && (
                    <button type="button" className="pn-text-btn" onClick={() => setSelectedInstituteIds([])}>
                      Clear all
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="pn-input pn-target-search"
                  placeholder="Filter institutes by name or slug..."
                  value={instituteSearch}
                  onChange={(e) => setInstituteSearch(e.target.value)}
                />
                <div className="pn-chip-list">
                  {filteredInstitutes.map((inst) => {
                    const active = selectedInstituteIds.includes(inst.id);
                    return (
                      <button
                        type="button"
                        key={inst.id}
                        className={`pn-chip ${active ? "is-active" : ""}`}
                        onClick={() => toggleInstitute(inst.id)}
                      >
                        <span>{active ? "✓" : "+"}</span>
                        <strong>{inst.name}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedAudiences.includes("specific_students") && (
              <div className="pn-target-container">
                <div className="pn-target-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="user" />
                    <span>Select Target Students ({selectedUserIds.length} selected)</span>
                  </div>
                  {selectedUserIds.length > 0 && (
                    <button type="button" className="pn-text-btn" onClick={() => setSelectedUserIds([])}>
                      Clear all
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="pn-input pn-target-search"
                  placeholder="Filter students by name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <div className="pn-chip-list">
                  {filteredStudents.map((st) => {
                    const active = selectedUserIds.includes(st.id);
                    return (
                      <button
                        type="button"
                        key={st.id}
                        className={`pn-chip ${active ? "is-active" : ""}`}
                        onClick={() => toggleStudent(st.id)}
                      >
                        <span>{active ? "✓" : "+"}</span>
                        <strong>{st.name}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pn-form-group">
              <label>Publish Timing & Scheduling</label>
              {(() => {
                const TIMING_OPTIONS = [
                  { key: "published", label: "Send Immediately", icon: "notifications" as const },
                  { key: "scheduled", label: "Schedule for Later", icon: "session" as const },
                  { key: "draft", label: "Save as Draft", icon: "edit" as const },
                ];
                const activeTimingIdx = TIMING_OPTIONS.findIndex((opt) => opt.key === status);
                return (
                  <div className="apple-segmented-control">
                    <div
                      className="apple-segmented-thumb"
                      style={{
                        width: "calc((100% - 4px) / 3)",
                        transform: `translateX(calc(${activeTimingIdx} * 100%))`,
                      }}
                    />
                    {TIMING_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setStatus(opt.key as "published" | "scheduled" | "draft")}
                        className={`apple-segmented-tab ${status === opt.key ? "is-active" : ""}`}
                      >
                        <Icon name={opt.icon} />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {status === "scheduled" && (
                <div style={{ marginTop: 12 }}>
                  <label htmlFor="scheduled-datetime-input">Schedule Date & Time</label>
                  <input
                    id="scheduled-datetime-input"
                    type="datetime-local"
                    className="pn-input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>
              )}
            </div>

            <button type="submit" className="pn-submit-btn" disabled={busy}>
              {busy
                ? "Processing..."
                : status === "scheduled"
                  ? "Schedule Notification"
                  : status === "draft"
                    ? "Save Draft"
                    : "Publish Notification"}
            </button>
          </form>
        </div>

        {/* Right Section: Notification History */}
        <div className="pn-card pn-history-card">
          <div className="pn-card-header">
            <div>
              <h2 className="pn-card-title">Notification History</h2>
              <p className="pn-card-subtitle">Review published, scheduled, and draft platform announcements.</p>
            </div>
            <span className="pn-history-count">{announcements.length}</span>
          </div>

          <div className="pn-history-toolbar">
            <div className="pn-search-wrap">
              <Icon name="search" />
              <input
                type="text"
                placeholder="Search title or content..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pn-history-search"
              />
            </div>
            {(() => {
              const STATUS_TABS = ["ALL", "PUBLISHED", "SCHEDULED", "DRAFT"] as const;
              const activeTabIdx = STATUS_TABS.indexOf(historyStatusFilter);
              return (
                <div className="apple-segmented-control">
                  <div
                    className="apple-segmented-thumb"
                    style={{
                      width: "calc((100% - 4px) / 4)",
                      transform: `translateX(calc(${activeTabIdx} * 100%))`,
                    }}
                  />
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setHistoryStatusFilter(tab)}
                      className={`apple-segmented-tab ${historyStatusFilter === tab ? "is-active" : ""}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="pn-history-list">
            {filteredAnnouncements.length === 0 ? (
              <div className="pn-empty-state">
                <Icon name="notifications" />
                <p>No notifications found matching your search or status filter.</p>
              </div>
            ) : (
              filteredAnnouncements.map((item) => (
                <article key={item.id} className="pn-history-item">
                  <div className="pn-history-item-top">
                    <span className={`pn-badge badge-${item.status}`}>
                      {item.status}
                    </span>
                    <span className="pn-history-date">
                      {item.status === "scheduled" && item.scheduled_at
                        ? `Scheduled: ${formatDate(item.scheduled_at)}`
                        : `Published: ${formatDate(item.published_at)}`}
                    </span>
                  </div>

                  <h3 className="pn-history-item-title">{item.title}</h3>
                  <p className="pn-history-item-body">{item.message}</p>

                  <div className="pn-history-item-bottom">
                    <span className="pn-audience-tag">Audience: {item.audience}</span>
                    <button
                      type="button"
                      className="pn-delete-btn"
                      onClick={() => void deleteAnnouncement(item.id)}
                      title="Delete Notification"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
