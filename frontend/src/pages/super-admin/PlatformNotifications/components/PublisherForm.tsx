import type { FormEvent } from "react";
import type { TargetInstituteOption, TargetStudentOption } from "@/api/types";
import { RequiredMark } from "@/components/ui";
import { platformNotificationsStrings as strings } from "../PlatformNotifications.strings";
import type { NotificationStatus } from "../types";
import { AudienceCardGrid } from "./AudienceCardGrid";
import { InstituteTargetPicker } from "./InstituteTargetPicker";
import { StudentTargetPicker } from "./StudentTargetPicker";
import { TimingControl } from "./TimingControl";

interface PublisherFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  selectedAudiences: string[];
  onToggleAudience: (key: string) => void;
  filteredInstitutes: TargetInstituteOption[];
  selectedInstituteIds: number[];
  instituteSearch: string;
  onInstituteSearchChange: (value: string) => void;
  onToggleInstitute: (id: number) => void;
  onSelectAllInstitutes: () => void;
  onClearInstitutes: () => void;
  filteredStudents: TargetStudentOption[];
  selectedUserIds: number[];
  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
  onToggleStudent: (id: number) => void;
  onSelectAllStudents: () => void;
  onClearStudents: () => void;
  status: NotificationStatus;
  onStatusChange: (status: NotificationStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  sendEmail: boolean;
  onSendEmailChange: (value: boolean) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  showHeader?: boolean;
}

export function PublisherForm({
  title,
  onTitleChange,
  message,
  onMessageChange,
  selectedAudiences,
  onToggleAudience,
  filteredInstitutes,
  selectedInstituteIds,
  instituteSearch,
  onInstituteSearchChange,
  onToggleInstitute,
  onSelectAllInstitutes,
  onClearInstitutes,
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
  sendEmail,
  onSendEmailChange,
  busy,
  onSubmit,
  showHeader = true,
}: PublisherFormProps) {
  const t = strings.publisher;
  const submitLabel = busy
    ? t.submitLabels.busy
    : status === "scheduled"
      ? t.submitLabels.scheduled
      : status === "draft"
        ? t.submitLabels.draft
        : t.submitLabels.published;

  return (
    <div className="pn-card pn-publisher-card">
      {showHeader && (
        <div className="pn-card-header">
          <div>
            <h2 className="pn-card-title">{t.title}</h2>
            <p className="pn-card-subtitle">{t.subtitle}</p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="pn-form">
        <div className="pn-form-group">
          <label htmlFor="platform-notification-title">{t.titleLabel}<RequiredMark /></label>
          <input
            id="platform-notification-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t.titlePlaceholder}
            required
            className="pn-input"
          />
        </div>

        <div className="pn-form-group">
          <label htmlFor="platform-notification-message">{t.messageLabel}<RequiredMark /></label>
          <textarea
            id="platform-notification-message"
            rows={4}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={t.messagePlaceholder}
            required
            className="pn-textarea"
          />
        </div>

        <div className="pn-form-group">
          <label>{t.audienceLabel}</label>
          <AudienceCardGrid selectedAudiences={selectedAudiences} onToggle={onToggleAudience} />
        </div>

        {selectedAudiences.includes("institutes") && (
          <InstituteTargetPicker
            institutes={filteredInstitutes}
            selectedIds={selectedInstituteIds}
            search={instituteSearch}
            onSearchChange={onInstituteSearchChange}
            onToggle={onToggleInstitute}
            onSelectAll={onSelectAllInstitutes}
            onClearAll={onClearInstitutes}
          />
        )}

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

        <div className="pn-form-group">
          <label>{t.timingLabel}</label>
          <TimingControl status={status} onStatusChange={onStatusChange} scheduledAt={scheduledAt} onScheduledAtChange={onScheduledAtChange} />
        </div>

        <div className="pn-form-group" style={{ marginTop: 14, marginBottom: 18 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-muted)",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(event) => onSendEmailChange(event.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                accentColor: "var(--primary)",
                cursor: "pointer"
              }}
            />
            <span>Also send as email notification to targeted audience</span>
          </label>
        </div>

        <button type="submit" className="pn-submit-btn" disabled={busy}>
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
