import { Icon } from "@/components/icons";
import { RequiredMark, SegmentedControl } from "@/components/ui";
import { platformNotificationsStrings as strings, timingOptions } from "../PlatformNotifications.strings";
import type { NotificationStatus } from "../types";

interface TimingControlProps {
  status: NotificationStatus;
  onStatusChange: (status: NotificationStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
}

export function TimingControl({ status, onStatusChange, scheduledAt, onScheduledAtChange }: TimingControlProps) {
  return (
    <>
      <SegmentedControl
        ariaLabel="Notification timing"
        fullWidth
        onChange={onStatusChange}
        options={timingOptions.map((option) => ({
          icon: <Icon name={option.icon} />,
          label: option.label,
          value: option.key as NotificationStatus,
        }))}
        value={status}
      />

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
