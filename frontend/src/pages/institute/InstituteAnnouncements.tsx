import { type FormEvent, useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { Announcement, TargetStudentOption } from "../../api/types";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";

interface TargetOptions {
  students: TargetStudentOption[];
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Draft";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function InstituteAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targetOptions, setTargetOptions] = useState<TargetOptions>({ students: [] });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["students"]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [status, setStatus] = useState<"published" | "scheduled" | "draft">("published");
  const [scheduledAt, setScheduledAt] = useState("");

  const [studentSearch, setStudentSearch] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [announcementsRes, optionsRes] = await Promise.all([
        apiClient.get<Announcement[]>("/institute/announcements"),
        apiClient.get<TargetOptions>("/institute/announcements/target-options"),
      ]);
      setAnnouncements(announcementsRes.data);
      setTargetOptions(optionsRes.data);
      setError(null);
    } catch {
      setError("Announcements or student list could not be loaded.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

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
    if (key === "specific_students") {
      next = next.filter((a) => a !== "students");
    }
    if (key === "students") {
      next = next.filter((a) => a !== "specific_students");
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

  function toggleStudent(id: number) {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((i) => i !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (status === "scheduled" && !scheduledAt) {
      setError("Please select a date and time for scheduled announcement.");
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
      target_user_ids: selectedAudiences.includes("specific_students") ? selectedUserIds : [],
    };

    try {
      await apiClient.post("/institute/announcements", payload);
      setTitle("");
      setMessage("");
      setSelectedAudiences(["students"]);
      setSelectedUserIds([]);
      setStatus("published");
      setScheduledAt("");
      await loadData();
    } catch {
      setError("Announcement could not be saved or published.");
    } finally {
      setBusy(false);
    }
  }

  const studentQuery = normalizeSearch(studentSearch);
  const filteredStudents = targetOptions.students
    .filter((st) => {
      const haystack = [st.name, st.email, String(st.id)].join(" ").toLowerCase();
      return !studentQuery || haystack.includes(studentQuery);
    })
    .sort((a, b) => Number(selectedUserIds.includes(b.id)) - Number(selectedUserIds.includes(a.id)) || a.name.localeCompare(b.name));

  const audienceCards = [
    { key: "students", title: "Students", icon: "ST", desc: "All institute students" },
    { key: "staff", title: "Staff", icon: "SF", desc: "Instructors and institute staff" },
    { key: "specific_students", title: "Specific Students", icon: "1:1", desc: "Select individual students" },
    { key: "all", title: "Everyone", icon: "ALL", desc: "All institute members" },
  ];

  return (
    <div className="announcement-admin-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Institute notifications</span>
          <h1>Announcements</h1>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="announcement-admin-grid">
        <CollapsiblePanel
          className="workspace-panel announcement-publisher-panel"
          title="New announcement"
          description="Notify students, staff, or specific individual students with scheduling options."
        >
          <form onSubmit={(event) => void publish(event)}>
            <label htmlFor="institute-announcement-title">Title</label>
            <input
              id="institute-announcement-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Test Schedule Update"
              required
            />

            <label htmlFor="institute-announcement-message">Message</label>
            <textarea
              id="institute-announcement-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write announcement details..."
              required
            />

            <label>Target audience</label>
            <div className="audience-cards-grid">
              {audienceCards.map((card) => {
                const isSelected = selectedAudiences.includes(card.key);
                return (
                  <div
                    key={card.key}
                    className={`audience-checkbox-card ${isSelected ? "selected" : ""}`}
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
                    <div className="audience-card-checkbox-custom">
                      {isSelected && <span>✓</span>}
                    </div>
                    <div className="audience-card-body">
                      <span className="audience-card-title"><span className="audience-card-icon">{card.icon}</span>{card.title}</span>
                      <span className="audience-card-desc">{card.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedAudiences.includes("specific_students") && (
              <div className="custom-target-select-container">
                <div className="custom-target-header">
                  <span>Select target students ({selectedUserIds.length} selected)</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    {filteredStudents.length > 0 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...filteredStudents.map((st) => st.id)])))}
                      >
                        Select all
                      </button>
                    )}
                    {selectedUserIds.length > 0 && (
                      <button type="button" className="text-button" onClick={() => setSelectedUserIds([])}>
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  className="target-search-input"
                  placeholder="Search students by name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <div className="chip-select-list">
                  {filteredStudents.map((st) => {
                    const active = selectedUserIds.includes(st.id);
                    return (
                      <button
                        type="button"
                        key={st.id}
                        className={`chip-option ${active ? "active" : ""}`}
                        onClick={() => toggleStudent(st.id)}
                      >
                        <span>{active ? "✓" : "+"}</span>
                        <strong>{st.name}</strong>
                        <small>{st.email}</small>
                      </button>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <small className="help-text">No matching students found in this institute.</small>
                  )}
                </div>
              </div>
            )}

            <div className="schedule-timing-group">
              <label>Publish timing</label>
              <div className="schedule-timing-options">
                <div
                  className={`schedule-timing-pill ${status === "published" ? "selected" : ""}`}
                  onClick={() => setStatus("published")}
                >
                  Send now
                </div>
                <div
                  className={`schedule-timing-pill ${status === "scheduled" ? "selected" : ""}`}
                  onClick={() => setStatus("scheduled")}
                >
                  Schedule
                </div>
                <div
                  className={`schedule-timing-pill ${status === "draft" ? "selected" : ""}`}
                  onClick={() => setStatus("draft")}
                >
                  Draft
                </div>
              </div>

              {status === "scheduled" && (
                <div>
                  <label htmlFor="scheduled-datetime-input">Schedule Date & Time</label>
                  <input
                    id="scheduled-datetime-input"
                    type="datetime-local"
                    className="datetime-picker-input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                  <small className="help-text">Announcement will automatically publish at this date and time.</small>
                </div>
              )}
            </div>

            <button disabled={busy} style={{ marginTop: 12 }}>
              {busy
                ? "Processing..."
                : status === "scheduled"
                  ? "Schedule announcement"
                  : status === "draft"
                    ? "Save draft"
                    : "Publish announcement"}
            </button>
          </form>
        </CollapsiblePanel>

        <CollapsiblePanel
          className="workspace-panel announcement-history-panel"
          title="Announcement history"
          description="Review published, scheduled, and draft institute announcements."
          badge={<span className="count-chip">{announcements.length}</span>}
        >
          <div className="announcement-history-list">
            {announcements.length === 0 && (
              <div className="announcement-empty-state">
                <strong>No announcements yet</strong>
                <span>Published, scheduled, and draft announcements will appear here.</span>
              </div>
            )}
            {announcements.map((item) => (
              <article key={item.id}>
                <div>
                  <span
                    className={`badge ${item.status === "published"
                        ? "badge-green"
                        : item.status === "scheduled"
                          ? "badge-purple"
                          : "badge-gray"
                      }`}
                  >
                    {item.status}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                  <small>
                    Audience: {item.audience}
                    {item.status === "scheduled" && item.scheduled_at
                      ? ` · Scheduled for: ${formatDate(item.scheduled_at)}`
                      : ` · Published: ${formatDate(item.published_at)}`}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </CollapsiblePanel>
      </div>
    </div>
  );
}
