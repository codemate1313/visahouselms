import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { Announcement } from "@/api/types";
import { Button, Modal, PageHeader } from "@/components/ui";
import { normalizeSearch } from "./helpers";
import { instituteAnnouncementsStrings as strings } from "./InstituteAnnouncements.strings";
import type { AnnouncementStatus, TargetOptions } from "./types";
import { PublisherPanel } from "./components/PublisherPanel";
import { AnnouncementHistoryPanel } from "./components/AnnouncementHistoryPanel";

export function InstituteAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targetOptions, setTargetOptions] = useState<TargetOptions>({ students: [] });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["students"]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [status, setStatus] = useState<AnnouncementStatus>("published");
  const [scheduledAt, setScheduledAt] = useState("");

  const [studentSearch, setStudentSearch] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
      setError(strings.loadError);
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
      setError(strings.scheduleRequiredError);
      setBusy(false);
      return;
    }
    if (selectedAudiences.includes("specific_students") && selectedUserIds.length === 0) {
      setError(strings.studentRequiredError);
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
      setIsCreateOpen(false);
      await loadData();
    } catch {
      setError(strings.saveError);
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
  const visibleAnnouncements = announcements.filter((item) => item.status === "published" || item.status === "draft");

  return (
    <div className="announcement-admin-page">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            {strings.publishNew}
          </Button>
        }
      />
      {error && <p className="error-text">{error}</p>}
      <div className="announcement-admin-grid is-history-only">
        <AnnouncementHistoryPanel announcements={visibleAnnouncements} />
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={strings.publisher.dialogTitle}
        size="lg"
      >
        <PublisherPanel
          title={title}
          onTitleChange={setTitle}
          message={message}
          onMessageChange={setMessage}
          selectedAudiences={selectedAudiences}
          onToggleAudience={toggleAudienceCard}
          filteredStudents={filteredStudents}
          selectedUserIds={selectedUserIds}
          studentSearch={studentSearch}
          onStudentSearchChange={setStudentSearch}
          onToggleStudent={toggleStudent}
          onSelectAllStudents={() => setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...filteredStudents.map((st) => st.id)])))}
          onClearStudents={() => setSelectedUserIds([])}
          status={status}
          onStatusChange={setStatus}
          scheduledAt={scheduledAt}
          onScheduledAtChange={setScheduledAt}
          busy={busy}
          onSubmit={(event) => void publish(event)}
        />
      </Modal>
    </div>
  );
}
