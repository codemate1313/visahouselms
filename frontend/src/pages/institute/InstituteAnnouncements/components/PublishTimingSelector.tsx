import { instituteAnnouncementsStrings as strings } from "../InstituteAnnouncements.strings";
import type { AnnouncementStatus } from "../types";

interface PublishTimingSelectorProps {
  status: AnnouncementStatus;
  onStatusChange: (status: AnnouncementStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
}

export function PublishTimingSelector({ status, onStatusChange, scheduledAt, onScheduledAtChange }: PublishTimingSelectorProps) {
  const t = strings.publisher;
  return (
    <div className="schedule-timing-group">
      <label>{t.timingLabel}</label>
      <div className="schedule-timing-options">
        <div className={`schedule-timing-pill ${status === "published" ? "selected" : ""}`} onClick={() => onStatusChange("published")}>
          {t.timingOptions.published}
        </div>
        <div className={`schedule-timing-pill ${status === "scheduled" ? "selected" : ""}`} onClick={() => onStatusChange("scheduled")}>
          {t.timingOptions.scheduled}
        </div>
        <div className={`schedule-timing-pill ${status === "draft" ? "selected" : ""}`} onClick={() => onStatusChange("draft")}>
          {t.timingOptions.draft}
        </div>
      </div>

      {status === "scheduled" && (
        <div>
          <label htmlFor="scheduled-datetime-input">{t.scheduleLabel}</label>
          <input
            id="scheduled-datetime-input"
            type="datetime-local"
            className="datetime-picker-input"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            required
          />
          <small className="help-text">{t.scheduleHint}</small>
        </div>
      )}
    </div>
  );
}
