import { RequiredMark, SegmentedControl } from "@/components/ui";
import { instituteAnnouncementsStrings as strings } from "../InstituteAnnouncements.strings";
import type { AnnouncementStatus } from "../types";

interface PublishTimingSelectorProps {
  status: AnnouncementStatus;
  onStatusChange: (status: AnnouncementStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
}

function toDatetimeLocalMinute(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join("-") + `T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function PublishTimingSelector({ status, onStatusChange, scheduledAt, onScheduledAtChange }: PublishTimingSelectorProps) {
  const t = strings.publisher;
  const minimumScheduleTime = toDatetimeLocalMinute(new Date());
  return (
    <div className="schedule-timing-group">
      <label>{t.timingLabel}</label>
      <SegmentedControl
        ariaLabel={t.timingLabel}
        fullWidth
        onChange={onStatusChange}
        options={[
          { label: t.timingOptions.published, value: "published" },
          { label: t.timingOptions.scheduled, value: "scheduled" },
          { label: t.timingOptions.draft, value: "draft" },
        ]}
        value={status}
      />

      {status === "scheduled" && (
        <div className="announcement-schedule-fields">
          <label htmlFor="scheduled-datetime-input">{t.scheduleLabel}<RequiredMark /></label>
          <input
            id="scheduled-datetime-input"
            type="datetime-local"
            className="datetime-picker-input"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            min={minimumScheduleTime}
            required
          />
          <small className="help-text">{t.scheduleHint}</small>
        </div>
      )}
    </div>
  );
}
