import type { FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark } from "@/components/ui";
import type { TargetStudentOption } from "@/api/types";
import { instituteAnnouncementsStrings as strings } from "../InstituteAnnouncements.strings";
import type { AnnouncementStatus } from "../types";
import { AudienceCardGrid } from "./AudienceCardGrid";
import { StudentTargetPicker } from "./StudentTargetPicker";
import { PublishTimingSelector } from "./PublishTimingSelector";

interface PublisherPanelProps {
  formId?: string;
  title: string;
  onTitleChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  selectedAudiences: string[];
  onToggleAudience: (key: string) => void;
  filteredStudents: TargetStudentOption[];
  selectedUserIds: number[];
  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
  onToggleStudent: (id: number) => void;
  onSelectAllStudents: () => void;
  onClearStudents: () => void;
  status: AnnouncementStatus;
  onStatusChange: (status: AnnouncementStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function PublisherPanel({
  formId,
  title,
  onTitleChange,
  message,
  onMessageChange,
  selectedAudiences,
  onToggleAudience,
  filteredStudents,
  selectedUserIds,
  studentSearch,
  onStudentSearchChange,
  onToggleStudent,
  onSelectAllStudents,
  onClearStudents,
  status,
  onStatusChange,
  scheduledAt,
  onScheduledAtChange,
  busy,
  onSubmit,
}: PublisherPanelProps) {
  const t = strings.publisher;
  const submitLabel = busy
    ? t.submitLabels.busy
    : status === "scheduled"
      ? t.submitLabels.scheduled
      : status === "draft"
        ? t.submitLabels.draft
        : t.submitLabels.published;

  return (
    <CollapsiblePanel className="workspace-panel announcement-publisher-panel" title={t.title} description={t.description}>
      <form id={formId} onSubmit={onSubmit}>
        <div className="announcement-publish-toolbar">
          <div>
            <strong>{submitLabel}</strong>
            <span>{status === "published" ? t.actionHintPublished : status === "scheduled" ? t.actionHintScheduled : t.actionHintDraft}</span>
          </div>
        </div>

        <label htmlFor="institute-announcement-title">{t.titleLabel}<RequiredMark /></label>
        <input
          id="institute-announcement-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={t.titlePlaceholder}
          required
        />

        <label htmlFor="institute-announcement-message">{t.messageLabel}<RequiredMark /></label>
        <textarea
          id="institute-announcement-message"
          rows={5}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder={t.messagePlaceholder}
          required
        />

        <label>{t.audienceLabel}</label>
        <AudienceCardGrid selectedAudiences={selectedAudiences} onToggle={onToggleAudience} />

        {selectedAudiences.includes("specific_students") && (
          <StudentTargetPicker
            students={filteredStudents}
            selectedIds={selectedUserIds}
            search={studentSearch}
            onSearchChange={onStudentSearchChange}
            onToggle={onToggleStudent}
            onSelectAll={onSelectAllStudents}
            onClearAll={onClearStudents}
          />
        )}

        <PublishTimingSelector status={status} onStatusChange={onStatusChange} scheduledAt={scheduledAt} onScheduledAtChange={onScheduledAtChange} />
      </form>
    </CollapsiblePanel>
  );
}
