import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { Announcement } from "@/api/types";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { normalizeSearch } from "./helpers";
import { platformNotificationsStrings as strings } from "./PlatformNotifications.strings";
import type { HistoryStatusFilter, NotificationStatus, TargetOptions } from "./types";
import { PublisherForm } from "./components/PublisherForm";
import { NotificationHistory } from "./components/NotificationHistory";

export function PlatformNotifications() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [targetOptions, setTargetOptions] = useState<TargetOptions>({ institutes: [], students: [] });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["students"]);
  const [selectedInstituteIds, setSelectedInstituteIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [status, setStatus] = useState<NotificationStatus>("published");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

  const [instituteSearch, setInstituteSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("ALL");

  const [isPublisherOpen, setIsPublisherOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const setTopBarAction = usePageTitleStore((state) => state.setTopBarAction);

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
      setError(strings.loadError);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setItemCount(announcements.length);
    return () => setItemCount(null);
  }, [announcements.length, setItemCount]);

  useEffect(() => {
    setTopBarAction(
      <button
        type="button"
        className="portal-primary-action-btn"
        onClick={() => setIsPublisherOpen(true)}
      >
        <Icon name="notifications" />
        <span>New Notification</span>
      </button>,
    );
    return () => setTopBarAction(null);
  }, [setTopBarAction]);

  function toggleAudienceCard(key: string) {
    if (key === "all") {
      const next = selectedAudiences.includes("all") ? ["students"] : ["all"];
      // Neither "students" nor "all" carries an id list, so any institute/
      // student picks made under a previous audience must not ride along.
      setSelectedInstituteIds([]);
      setSelectedUserIds([]);
      setSelectedAudiences(next);
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

    // Whenever an audience is deselected (dropped out of `next`), clear the
    // id selections that belong to it so stale institute/student picks can't
    // silently ride along to a different audience.
    if (!next.includes("institutes")) {
      setSelectedInstituteIds([]);
    }
    if (!next.includes("specific_students")) {
      setSelectedUserIds([]);
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
    const item = announcements.find((n) => n.id === id);
    const title = item ? item.title : strings.deleteFallbackTitle;
    if (!(await confirmDelete(strings.deleteConfirm(title), strings.deleteConfirmTitle))) return;
    try {
      await apiClient.delete(`/super-admin/announcements/${id}`);
      await loadData();
    } catch {
      setError(strings.deleteError);
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
    if (selectedAudiences.includes("institutes") && selectedInstituteIds.length === 0) {
      setError(strings.instituteRequiredError);
      setBusy(false);
      return;
    }
    if (selectedAudiences.includes("specific_students") && selectedUserIds.length === 0) {
      setError(strings.studentRequiredError);
      setBusy(false);
      return;
    }

    if (selectedAudiences.includes("all")) {
      const approxCount = targetOptions.students.length;
      const confirmMessage = approxCount > 0
        ? strings.everyoneConfirm(approxCount)
        : strings.everyoneConfirmNoCount;
      if (!(await confirmAction(confirmMessage, { title: strings.everyoneConfirmTitle, confirmText: "Notify Everyone", variant: "danger" }))) {
        setBusy(false);
        return;
      }
    }

    const payload = {
      title,
      message,
      audience: selectedAudiences.join(","),
      status,
      scheduled_at: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      target_institute_ids: selectedAudiences.includes("institutes") ? selectedInstituteIds : [],
      target_user_ids: selectedAudiences.includes("specific_students") ? selectedUserIds : [],
      send_email: sendEmail,
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
      setSendEmail(false);
      setIsPublisherOpen(false);
      await loadData();
    } catch {
      setError(strings.saveError);
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
    const matchesStatus = historyStatusFilter === "ALL" || item.status.toUpperCase() === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="announcement-admin-page">
      {error && (
        <p className="error-text" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="announcement-admin-history-shell">
        <NotificationHistory
          announcements={announcements}
          filteredAnnouncements={filteredAnnouncements}
          search={historySearch}
          onSearchChange={setHistorySearch}
          statusFilter={historyStatusFilter}
          onStatusFilterChange={setHistoryStatusFilter}
          onDelete={(id) => void deleteAnnouncement(id)}
        />
      </div>

      <Modal
        open={isPublisherOpen}
        onClose={() => setIsPublisherOpen(false)}
        size="lg"
        className="pn-publisher-modal"
        title={(
          <div className="pn-modal-title-block">
            <span>{strings.publisher.title}</span>
            <small>{strings.publisher.subtitle}</small>
          </div>
        )}
      >
        <PublisherForm
          title={title}
          onTitleChange={setTitle}
          message={message}
          onMessageChange={setMessage}
          selectedAudiences={selectedAudiences}
          onToggleAudience={toggleAudienceCard}
          filteredInstitutes={filteredInstitutes}
          selectedInstituteIds={selectedInstituteIds}
          instituteSearch={instituteSearch}
          onInstituteSearchChange={setInstituteSearch}
          onToggleInstitute={toggleInstitute}
          onSelectAllInstitutes={() =>
            setSelectedInstituteIds(Array.from(new Set([...selectedInstituteIds, ...filteredInstitutes.map((inst) => inst.id)])))
          }
          onClearInstitutes={() => setSelectedInstituteIds([])}
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
          sendEmail={sendEmail}
          onSendEmailChange={setSendEmail}
          busy={busy}
          onSubmit={(event) => void publish(event)}
          showHeader={false}
        />
      </Modal>
    </div>
  );
}
