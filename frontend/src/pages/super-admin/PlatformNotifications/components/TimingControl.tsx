import { Icon } from "@/components/icons";
import { RequiredMark } from "@/components/ui";
import { platformNotificationsStrings as strings, timingOptions } from "../PlatformNotifications.strings";
import type { NotificationStatus } from "../types";

interface TimingControlProps {
  status: NotificationStatus;
  onStatusChange: (status: NotificationStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
}

export function TimingControl({ status, onStatusChange, scheduledAt, onScheduledAtChange }: TimingControlProps) {
  const activeTimingIdx = timingOptions.findIndex((opt) => opt.key === status);
  return (
    <>
      <div className="apple-segmented-control">
        <div
          className="apple-segmented-thumb"
          style={{
            width: "calc((100% - 4px) / 3)",
            transform: `translateX(calc(${activeTimingIdx} * 100%))`,
          }}
        />
        {timingOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onStatusChange(opt.key as NotificationStatus)}
            className={`apple-segmented-tab ${status === opt.key ? "is-active" : ""}`}
          >
            <Icon name={opt.icon} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {status === "scheduled" && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="scheduled-datetime-input">{strings.publisher.scheduleLabel}<RequiredMark /></label>
          <input
            id="scheduled-datetime-input"
            type="datetime-local"
            className="pn-input"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            required
          />
        </div>
      )}
    </>
  );
}
